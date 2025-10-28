import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {mkdir} from 'node:fs/promises'
import filenamify from 'filenamify'
import pLimit from 'p-limit'
import {extractYouTubeId} from '../src/lib/utils.ts'
import {getPg} from '../src/lib/r5/db.js'

/**
 * Update download status in database
 */
async function updateDownloadStatus(trackId, status, error = null, filePath = null) {
	try {
		const pg = await getPg()
		await pg.sql`
			UPDATE tracks
			SET download_status = ${status},
				download_error = ${error},
				download_attempted_at = CURRENT_TIMESTAMP,
				download_path = ${filePath}
			WHERE id = ${trackId}
		`
	} catch (dbError) {
		console.warn(`Failed to update download status for ${trackId}:`, dbError.message)
	}
}

/**
 * Downloads audio from a URL using yt-dlp
 */
async function downloadAudio(url, filepath, metadataDescription = '', premium = false, poToken) {
	const args = [
		'-f',
		'bestaudio/best',
		'--no-playlist',
		'--restrict-filenames',
		'--output',
		filepath,
		'--parse-metadata',
		`${metadataDescription}:%(meta_comment)s`,
		'--embed-metadata',
		'--quiet',
		'--progress',
		url
	]

	if (premium) {
		if (!poToken) {
			throw new Error('Premium download requires a PO Token. Please provide it with --poToken parameter.')
		}
		args.push(
			'--cookies-from-browser',
			'firefox',
			'--extractor-args',
			`youtube:player-client=web_music;po_token=web_music.gvs+${poToken}`
		)
	}

	return new Promise((resolve, reject) => {
		const child = spawn('yt-dlp', args, {stdio: 'inherit'})
		child.on('close', (code) => {
			if (code === 0) {
				resolve()
			} else {
				reject(new Error(`yt-dlp exited with code ${code}`))
			}
		})
		child.on('error', reject)
	})
}

/**
 * Create safe filename from track data
 */
function toFilename(track, folderPath) {
	if (!track.title || typeof track.title !== 'string') {
		throw new Error(`Invalid track title: ${JSON.stringify(track.title)}`)
	}

	const youtubeId = extractYouTubeId(track.url)
	if (!youtubeId) {
		throw new Error(`Could not extract YouTube ID from URL: ${track.url}`)
	}

	const cleanTitle = filenamify(track.title, {replacement: ' ', maxLength: 255})
	return `${folderPath}/${cleanTitle} [${youtubeId}].m4a`
}

/**
 * Download a single track
 */
async function downloadTrack(track, folderPath, options = {}) {
	const {simulate = false, premium = false, poToken, skipRecentFailures = true} = options

	if (!track?.url || !track?.title) {
		console.error('Invalid track data:', track?.title || 'Unknown')
		await updateDownloadStatus(track.id, 'failed', 'Invalid track data')
		return {success: false, error: 'Invalid track data'}
	}

	// Skip recently failed tracks (within last 24 hours) unless retrying
	if (skipRecentFailures && track.download_status === 'failed' && track.download_attempted_at) {
		const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
		const lastAttempt = new Date(track.download_attempted_at)
		if (lastAttempt > dayAgo) {
			console.log(`Skipping recently failed: ${track.title}`)
			return {success: false, error: 'Recently failed', recentlyFailed: true}
		}
	}

	try {
		const filename = toFilename(track, folderPath)
		await updateDownloadStatus(track.id, 'downloading')

		if (simulate) {
			console.log(`Would download: "${track.title}" to ${filename}`)
			await updateDownloadStatus(track.id, 'pending')
			return {success: true, filename, simulated: true}
		}

		// Check if file already exists
		if (existsSync(filename)) {
			console.log(`Skipping existing: ${track.title}`)
			await updateDownloadStatus(track.id, 'skipped', null, filename)
			return {success: true, filename, skipped: true}
		}

		await downloadAudio(track.url, filename, track.description || '', premium, poToken)
		console.log(`Downloaded: ${track.title}`)
		await updateDownloadStatus(track.id, 'success', null, filename)
		return {success: true, filename}
	} catch (error) {
		const errorMsg = error.stderr?.toString() || error.message || 'Unknown error'
		console.error(`Failed to download "${track.title}" (${track.url}): ${errorMsg}`)

		// Check for common YouTube API issues
		if (
			errorMsg.includes('HTTP Error 403') ||
			errorMsg.includes('fragment 1 not found') ||
			errorMsg.includes('Requested format is not available')
		) {
			console.error('Try updating yt-dlp (`brew upgrade yt-dlp`)')
		}

		await updateDownloadStatus(track.id, 'failed', errorMsg)
		return {success: false, error: errorMsg}
	}
}

/**
 * Download all tracks for a channel
 */
export async function downloadChannel(slug, folderPath, options = {}) {
	const {r5, concurrency = 5, simulate = false, premium = false, poToken, retryFailed = false} = options

	// Create folder structure
	const channelFolder = `${folderPath}/${slug}`
	const tracksFolder = `${channelFolder}/tracks`

	if (!simulate) {
		await mkdir(tracksFolder, {recursive: true})
	} else {
		console.log(`Would create folder: ${tracksFolder}`)
	}

	// Pull channel first, then tracks from remote to local
	console.log(`Fetching tracks for channel: ${slug}`)
	let tracks = []

	try {
		// Pull channel first (required for tracks.pull to work)
		await r5.channels.pull({slug})

		// Then pull tracks from appropriate source (uses channel.source field)
		tracks = await r5.tracks.pull({slug})
		console.log(`Found ${tracks.length} tracks (synced to local)`)
	} catch (error) {
		console.log(`Pull failed: ${error.message}. Trying local fallback...`)
		// Fallback to local only if pull fails
		tracks = await r5.tracks.local({slug})
		console.log(`Found ${tracks.length} tracks from local`)
	}

	if (!tracks?.length) {
		console.log('No tracks found in any source')
		return {downloaded: 0, failed: 0, skipped: 0}
	}

	// Download with concurrency limit
	const limit = pLimit(concurrency)
	const results = await Promise.all(
		tracks.map((track) =>
			limit(() => downloadTrack(track, tracksFolder, {simulate, premium, poToken, skipRecentFailures: !retryFailed}))
		)
	)

	// Count results
	const downloaded = results.filter((r) => r.success && !r.skipped && !r.simulated).length
	const failed = results.filter((r) => !r.success && !r.recentlyFailed).length
	const recentlyFailed = results.filter((r) => r.recentlyFailed).length
	const skipped = results.filter((r) => r.skipped).length
	const simulated = results.filter((r) => r.simulated).length

	// Summary
	if (simulate) {
		console.log(`\nSimulation complete: ${simulated} tracks would be downloaded`)
	} else {
		console.log(`\nDownload complete:`)
		console.log(`- Downloaded: ${downloaded}`)
		console.log(`- Skipped: ${skipped}`)
		console.log(`- Failed: ${failed}`)
		if (recentlyFailed > 0) {
			console.log(`- Recently failed (skipped): ${recentlyFailed}`)
			console.log(`  Use --retry-failed to retry failed downloads`)
		}
	}

	return {downloaded, failed, skipped, simulated, recentlyFailed}
}
