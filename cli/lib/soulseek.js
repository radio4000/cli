/**
 * Soulseek download via slskd API
 * Connects to a user's running slskd instance for high-quality audio downloads
 *
 * slskd must be running separately (Docker or native)
 * Default: http://localhost:5030
 *
 * @see https://github.com/slskd/slskd
 */

import {existsSync} from 'node:fs'
import {mkdir, rename} from 'node:fs/promises'
import {extname, join} from 'node:path'
import getArtistTitle from 'get-artist-title'
import {toFilename} from './filenames.js'

// ===== CONSTANTS =====

const DEFAULT_HOST = 'localhost'
const DEFAULT_PORT = 5030
const DEFAULT_USERNAME = 'slskd'
const DEFAULT_PASSWORD = 'slskd'

const LOSSLESS_FORMATS = ['flac', 'wav', 'ape', 'wv', 'alac']
const MIN_BITRATE = 320

// Quality ranking: higher is better
const FORMAT_SCORES = {
	flac: 1000,
	wav: 900,
	mp3: 100,
	ogg: 100,
	m4a: 100,
	aac: 80
}

// ===== HELPERS =====

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Recursively find a file by name in a directory
async function findDownloadedFile(dir, fileName) {
	const {readdir} = await import('node:fs/promises')
	const entries = await readdir(dir, {withFileTypes: true})

	for (const entry of entries) {
		const fullPath = join(dir, entry.name)
		if (entry.isDirectory()) {
			const found = await findDownloadedFile(fullPath, fileName)
			if (found) return found
		} else if (entry.name === fileName) {
			return fullPath
		}
	}
	return null
}

const rankResults = (files) =>
	files
		.map((file) => ({...file, score: calculateScore(file)}))
		.sort((a, b) => b.score - a.score)

const calculateScore = (file) => {
	let score = FORMAT_SCORES[file.extension] || 50

	if (file.isLossless) score += 500
	if (!file.isLossless && file.bitrate) score += Math.min(file.bitrate, 320)

	score -= Math.min(file.queueLength * 10, 100)
	score += Math.min(file.uploadSpeed / 10000, 50)

	return score
}

const buildSearchQuery = (title) => {
	// Try to parse artist - title format
	const parsed = getArtistTitle(title)
	if (parsed) {
		const [artist, trackTitle] = parsed
		// Use both artist and title for better matching
		return `${artist} ${trackTitle}`.trim()
	}

	// Fallback: clean up the title
	return title
		.replace(/\([^)]*(?:video|audio|official|remaster|remix|edit)[^)]*\)/gi, '')
		.replace(/\[[^\]]*(?:video|audio|official|remaster)[^\]]*\]/gi, '')
		.replace(/\s+(?:feat\.?|ft\.?|featuring)\s+/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim()
}

// ===== CLIENT =====

/**
 * Create slskd API client
 * Returns an object with methods to search and download from Soulseek
 */
export function createClient(config = {}) {
	const host = config.host || DEFAULT_HOST
	const port = config.port || DEFAULT_PORT
	const baseUrl = `http://${host}:${port}/api/v0`
	let token = null

	async function authenticate() {
		const username = config.username || DEFAULT_USERNAME
		const password = config.password || DEFAULT_PASSWORD

		const response = await fetch(`${baseUrl}/session`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({username, password})
		})

		if (!response.ok) {
			const text = await response.text()
			throw new Error(`slskd auth failed (${response.status}): ${text}`)
		}

		const data = await response.json()
		token = data.token
		return token
	}

	async function request(path, options = {}) {
		if (!token) await authenticate()

		const response = await fetch(`${baseUrl}${path}`, {
			...options,
			headers: {
				...options.headers,
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			}
		})

		if (response.status === 401) {
			await authenticate()
			return request(path, options)
		}

		return response
	}

	async function checkConnection() {
		try {
			await authenticate()
			const response = await request('/application')
			if (!response.ok) {
				throw new Error(`slskd not responding (${response.status})`)
			}
			return true
		} catch (error) {
			if (error.cause?.code === 'ECONNREFUSED') {
				throw new Error(
					`Cannot connect to slskd at ${host}:${port}. Is slskd running?`
				)
			}
			throw error
		}
	}

	async function search(query, options = {}) {
		const {timeout = 15000, minBitrate = MIN_BITRATE} = options

		const searchResponse = await request('/searches', {
			method: 'POST',
			body: JSON.stringify({
				searchText: query,
				searchTimeout: timeout,
				filterResponses: true,
				minimumResponseFileCount: 1
			})
		})

		if (!searchResponse.ok) {
			const text = await searchResponse.text()
			throw new Error(`Search failed: ${text}`)
		}

		const {id: searchId} = await searchResponse.json()

		// Poll for completion
		const start = Date.now()
		while (Date.now() - start < timeout + 5000) {
			const stateRes = await request(`/searches/${searchId}`)
			if (stateRes.ok) {
				const state = await stateRes.json()
				if (state.state === 'Completed' || state.isComplete) break
			}
			await sleep(1000)
		}

		// Get and filter results
		const responsesRes = await request(`/searches/${searchId}/responses`)
		if (!responsesRes.ok) return []

		const responses = await responsesRes.json()
		const files = []

		for (const response of responses) {
			for (const file of response.files || []) {
				const ext = extname(file.filename).slice(1).toLowerCase()
				const bitrate = file.bitRate || 0
				const isLossless = LOSSLESS_FORMATS.includes(ext)

				if (isLossless || bitrate >= minBitrate) {
					files.push({
						username: response.username,
						filename: file.filename,
						size: file.size,
						bitrate,
						extension: ext,
						isLossless,
						queueLength: response.queueLength || 0,
						uploadSpeed: response.uploadSpeed || 0
					})
				}
			}
		}

		return rankResults(files)
	}

	async function queueDownload(file) {
		const response = await request(`/transfers/downloads/${file.username}`, {
			method: 'POST',
			body: JSON.stringify([{filename: file.filename, size: file.size}])
		})

		if (!response.ok) {
			const text = await response.text()
			throw new Error(`Failed to queue download: ${text}`)
		}

		return file.filename
	}

	async function waitForDownload(username, filename, options = {}) {
		const {maxWait = 300000, onProgress} = options
		const start = Date.now()

		while (Date.now() - start < maxWait) {
			const response = await request('/transfers/downloads')
			if (!response.ok) {
				await sleep(2000)
				continue
			}

			const data = await response.json()

			// Flatten nested structure: [{username, directories: [{files: [...]}]}]
			let transfer = null
			for (const user of data) {
				if (user.username !== username) continue
				for (const dir of user.directories || []) {
					for (const file of dir.files || []) {
						if (file.filename === filename || file.id === filename) {
							transfer = file
							break
						}
					}
					if (transfer) break
				}
				if (transfer) break
			}

			if (transfer) {
				if (onProgress) onProgress(transfer)

				if (transfer.state === 'Completed' || transfer.state === 'Succeeded') {
					// Find the actual file on disk
					const downloadsDir = await getDownloadsDirectory()
					const fileName = transfer.filename.split('\\').pop()
					const localPath = await findDownloadedFile(downloadsDir, fileName)
					return {localPath, size: transfer.size}
				}

				if (['Errored', 'Rejected', 'Cancelled'].includes(transfer.state)) {
					throw new Error(`Download failed: ${transfer.state}`)
				}
			}

			await sleep(2000)
		}

		throw new Error('Download timed out')
	}

	async function getDownloadsDirectory() {
		const response = await request('/options')
		if (response.ok) {
			const opts = await response.json()
			return opts.directories?.downloads || '/app/downloads'
		}
		return '/app/downloads'
	}

	return {checkConnection, search, queueDownload, waitForDownload}
}

// ===== DOWNLOAD FUNCTIONS =====

/**
 * Download a single track via Soulseek
 */
export async function downloadTrack(client, track, outputDir, options = {}) {
	const {verbose = false, minBitrate = MIN_BITRATE} = options
	const query = buildSearchQuery(track.title)

	if (verbose) console.log(`  Searching: "${query}"`)

	const results = await client.search(query, {
		timeout: options.searchTimeout || 15000,
		minBitrate
	})

	if (results.length === 0) {
		return {status: 'no_match', track, query}
	}

	const best = results[0]

	if (verbose) {
		const quality = best.isLossless
			? best.extension.toUpperCase()
			: `${best.bitrate}kbps ${best.extension}`
		console.log(`  Found: ${quality} from ${best.username}`)
	}

	await client.queueDownload(best)

	const result = await client.waitForDownload(best.username, best.filename, {
		maxWait: options.downloadTimeout || 300000
	})

	// Move to output with proper naming
	const baseFilename = toFilename(track, {source: 'soulseek'})
	const destPath = join(outputDir, `${baseFilename}.${best.extension}`)

	if (existsSync(result.localPath) && !existsSync(destPath)) {
		await rename(result.localPath, destPath)
	}

	return {
		status: 'complete',
		track,
		path: destPath,
		quality: {
			format: best.extension,
			bitrate: best.bitrate,
			isLossless: best.isLossless
		}
	}
}

/**
 * Download multiple tracks with concurrency control
 */
export async function downloadTracks(client, tracks, folderPath, options = {}) {
	const {verbose = false, dryRun = false} = options

	const results = {complete: [], no_match: [], failed: [], skipped: []}
	const outputDir = join(folderPath, 'tracks')

	if (!dryRun) {
		await mkdir(outputDir, {recursive: true})
	}

	// Soulseek only allows one concurrent search, so process sequentially
	for (const [index, track] of tracks.entries()) {
		const progress = `[${index + 1}/${tracks.length}]`

		if (dryRun) {
			console.log(`${progress} Would search: ${track.title}`)
			results.skipped.push(track)
			continue
		}

		try {
			const result = await downloadTrack(client, track, outputDir, {
				verbose,
				...options
			})

			if (result.status === 'no_match') {
				console.log(`${progress} No match: ${track.title}`)
				results.no_match.push(track)
			} else {
				const quality = result.quality.isLossless
					? result.quality.format.toUpperCase()
					: `${result.quality.bitrate}kbps`
				console.log(`${progress} Downloaded: ${track.title} (${quality})`)
				results.complete.push(result)
			}
		} catch (error) {
			console.error(`${progress} Failed: ${track.title}`)
			if (verbose) console.error(`  ${error.message}`)
			results.failed.push({track, error: error.message})
		}
	}

	return results
}
