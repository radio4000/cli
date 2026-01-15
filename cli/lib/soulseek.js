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
import {copyFile, mkdir, unlink} from 'node:fs/promises'
import {extname, join} from 'node:path'
import getArtistTitle from 'get-artist-title'
import {readFailedTrackIds, writeFailures} from './download.js'
import {toFilename} from './filenames.js'

// ===== CONSTANTS =====

// DJ-compatible formats (CDJ/Rekordbox/Traktor/Serato compatible)
const LOSSLESS_FORMATS = ['flac', 'wav']
const LOSSY_FORMATS = ['mp3', 'ogg']
export const ALLOWED_FORMATS = [...LOSSLESS_FORMATS, ...LOSSY_FORMATS]
const MIN_BITRATE = 320

// Quality ranking: higher is better (DJ-compatible only)
const FORMAT_SCORES = {
	flac: 1000,
	wav: 900,
	mp3: 100,
	ogg: 100
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
	// get-artist-title handles basic cleanup
	const parsed = getArtistTitle(title)
	let query = parsed ? `${parsed[0]} ${parsed[1]}` : title

	// Strip parenthetical/bracketed content for search - Soulseek search
	// works better with simpler queries, and results include all versions anyway
	query = query.replace(/\s*[[(][^\])]*[\])]/g, '')

	return query.trim()
}

// ===== CLIENT =====

/**
 * Create slskd API client
 * Returns an object with methods to search and download from Soulseek
 */
export function createClient(config) {
	const {host, port, username, password} = config
	const baseUrl = `http://${host}:${port}/api/v0`
	let token = null

	async function authenticate() {
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
			throw new Error(`search failed: ${text}`)
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
				if (!ext) continue

				// Only DJ-compatible formats
				if (!ALLOWED_FORMATS.includes(ext)) continue

				const bitrate = file.bitRate || 0
				const isLossless = LOSSLESS_FORMATS.includes(ext)

				// Lossless: always accept. Lossy: require minimum bitrate
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
			throw new Error(`failed to queue download: ${text}`)
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

				// State can be "Completed", "Succeeded", or "Completed, Succeeded"
				const isComplete =
					transfer.state?.includes('Completed') ||
					transfer.state?.includes('Succeeded')
				if (isComplete) {
					// Find the actual file on disk
					const downloadsDir = await getDownloadsDirectory()
					const fileName = transfer.filename.split(/[\\/]/).pop()
					if (!fileName) {
						throw new Error('downloaded file name is empty')
					}
					const localPath = await findDownloadedFile(downloadsDir, fileName)
					if (!localPath) {
						throw new Error(`downloaded file not found: ${fileName}`)
					}
					return {localPath, size: transfer.size}
				}

				const isFailed =
					transfer.state?.includes('Errored') ||
					transfer.state?.includes('Rejected') ||
					transfer.state?.includes('Cancelled')
				if (isFailed) {
					throw new Error(`download failed: ${transfer.state}`)
				}
			}

			await sleep(2000)
		}

		throw new Error('download timed out')
	}

	async function getDownloadsDirectory() {
		// Allow override for Docker setups where container path differs from host path
		if (config.downloadsDir) {
			return config.downloadsDir
		}
		const response = await request('/options')
		if (!response.ok) {
			throw new Error(
				'failed to get slskd options - cannot determine downloads directory'
			)
		}
		const opts = await response.json()
		if (!opts.directories?.downloads) {
			throw new Error('slskd downloads directory not configured')
		}
		return opts.directories.downloads
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

	// Copy to output with proper naming (copy instead of rename for Docker/permission compat)
	const baseFilename = toFilename(track, {source: 'soulseek'})
	const destPath = join(outputDir, `${baseFilename}.${best.extension}`)

	if (existsSync(result.localPath) && !existsSync(destPath)) {
		await copyFile(result.localPath, destPath)
		// Try to remove source, but don't fail if we can't (Docker permissions)
		try {
			await unlink(result.localPath)
		} catch {
			// Ignore - file will stay in slskd downloads folder
		}
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
	const {verbose = false, dryRun = false, concurrency = 1} = options

	const results = {complete: [], no_match: [], failed: [], skipped: []}
	const outputDir = join(folderPath, 'soulseek')

	if (!dryRun) {
		await mkdir(outputDir, {recursive: true})
	}

	if (dryRun) {
		for (const [index, track] of tracks.entries()) {
			const progress = `[${index + 1}/${tracks.length}]`
			console.log(`${progress} Would search: ${track.title}`)
			results.skipped.push(track)
		}
		return results
	}

	// Serialize searches while allowing concurrent downloads.
	let searchQueue = Promise.resolve()
	const clientWithSerializedSearch = {
		...client,
		search: async (...args) => {
			const run = searchQueue.then(() => client.search(...args))
			searchQueue = run.catch((err) => {
				if (verbose) console.error('Search queue error:', err.message)
			})
			return run
		}
	}

	const limit = Math.max(1, concurrency)
	let nextIndex = 0

	const workers = Array.from({length: limit}, async () => {
		while (true) {
			const index = nextIndex++
			if (index >= tracks.length) return

			const track = tracks[index]
			const progress = `[${index + 1}/${tracks.length}]`

			try {
				const result = await downloadTrack(
					clientWithSerializedSearch,
					track,
					outputDir,
					{
						verbose,
						...options
					}
				)

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
	})

	await Promise.all(workers)

	return results
}

// ===== CHANNEL DOWNLOAD (matches lib/download.js API) =====

/**
 * Download a channel's tracks from Soulseek
 * Matches the API of downloadChannel in lib/download.js for consistency
 *
 * @param {Array} tracks - Tracks to download
 * @param {string} folderPath - Output folder path
 * @param {Object} options - Download options
 * @param {Object} options.slskdConfig - slskd client config (host, port, username, password, downloadsDir)
 */
export async function downloadChannel(tracks, folderPath, options = {}) {
	const {
		dryRun = false,
		verbose = false,
		force = false,
		retryFailed = false,
		concurrency = 2,
		minBitrate = 320,
		slskdConfig
	} = options

	if (!slskdConfig) {
		throw new Error('slskdConfig is required')
	}

	// Create client and verify connection
	const client = createClient(slskdConfig)

	if (!dryRun) {
		console.log(
			`Connecting to slskd at ${slskdConfig.host}:${slskdConfig.port}...`
		)
		try {
			await client.checkConnection()
			console.log('Connected to slskd')
			console.log()
		} catch (error) {
			console.error(`Failed to connect to slskd: ${error.message}`)
			console.error()
			console.error('Make sure slskd is running:')
			console.error(
				'  docker run -d --network host -e SLSKD_SLSK_USERNAME=user -e SLSKD_SLSK_PASSWORD=pass slskd/slskd'
			)
			console.error()
			console.error('Or configure in ~/.config/radio4000/config.json')
			throw error
		}
	}

	// Filter tracks that already exist
	const soulseekDir = join(folderPath, 'soulseek')
	const failedIds = retryFailed ? new Set() : readFailedTrackIds(folderPath)

	const hasExistingFile = (track) => {
		const baseFilename = toFilename(track, {source: 'soulseek'})
		return ALLOWED_FORMATS.some((ext) =>
			existsSync(join(soulseekDir, `${baseFilename}.${ext}`))
		)
	}

	const toDownload = force
		? tracks
		: tracks.filter((t) => !failedIds.has(t.id) && !hasExistingFile(t))

	const existing = tracks.filter(hasExistingFile).length
	const previouslyFailed = tracks.filter((t) => failedIds.has(t.id)).length

	console.log(`Total tracks: ${tracks.length}`)
	console.log(`  Already exists: ${existing}`)
	if (previouslyFailed > 0) {
		console.log(`  Previously failed: ${previouslyFailed}`)
	}
	console.log(`  To download: ${toDownload.length}`)
	console.log(`  Concurrency: ${concurrency}`)
	console.log(`  Min bitrate: ${minBitrate}kbps (or lossless)`)
	console.log()

	if (dryRun) {
		console.log('Would search and download:')
		for (const track of toDownload.slice(0, 5)) {
			console.log(`  ${track.title}`)
		}
		if (toDownload.length > 5) {
			console.log(`  [...${toDownload.length - 5} more]`)
		}
		return {
			total: tracks.length,
			downloaded: 0,
			existing,
			noMatch: 0,
			failed: 0,
			failures: []
		}
	}

	if (toDownload.length === 0) {
		console.log('Nothing to download.')
		return {
			total: tracks.length,
			downloaded: 0,
			existing,
			noMatch: 0,
			failed: 0,
			failures: []
		}
	}

	// Download tracks
	const results = await downloadTracks(client, toDownload, folderPath, {
		concurrency,
		verbose,
		minBitrate
	})

	// Write failures
	if (results.failed.length > 0) {
		await writeFailures(results.failed, folderPath, {verbose})
	}

	// Summary
	console.log()
	console.log('Summary:')
	console.log(`  Total: ${tracks.length}`)
	console.log(`  Downloaded: ${results.complete.length}`)
	console.log(`  Already exists: ${existing}`)
	console.log(`  No match found: ${results.no_match.length}`)
	console.log(`  Failed: ${results.failed.length}`)

	if (results.no_match.length > 0) {
		console.log()
		console.log(
			`⚠ ${results.no_match.length} tracks had no matches on Soulseek`
		)
	}

	if (results.failed.length > 0) {
		console.log()
		console.log(`⚠ ${results.failed.length} tracks failed to download`)
		console.log(`  See: ${folderPath}/failures.jsonl`)
	}

	// Return unified result format
	return {
		total: tracks.length,
		downloaded: results.complete.length,
		existing,
		noMatch: results.no_match.length,
		failed: results.failed.length,
		failures: results.failed
	}
}
