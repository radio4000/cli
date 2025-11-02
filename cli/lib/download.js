import {spawn} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {appendFile, mkdir, utimes, writeFile} from 'node:fs/promises'
import ffmetadata from 'ffmetadata'
import getArtistTitle from 'get-artist-title'
import {toExtension, toFilename} from './filenames.js'
import {channelToText, trackToText} from './formatters.js'
import {createCloudinaryImageUrl} from './images.js'
import {extractYouTubeId} from './media.js'
import pLimit from './p-limit-custom.js'

// Helper to format single channel/track (formatters handle arrays by default)
const formatChannelText = (ch) => channelToText(ch)
const formatTrackText = (tr) => trackToText(tr)

/**
 * Download pipeline for Radio4000 tracks
 * Pure functional approach - each function does one thing well
 *
 * PUBLIC API (6 exports):
 * - downloadChannel() - Main download orchestration
 * - writeChannelAbout() - Write channel info file
 * - writeChannelImageUrl() - Write image URL file
 * - writeTracksPlaylist() - Write M3U playlist
 * - toFilename() - Re-exported from filenames.js (used by tags)
 * - toExtension() - Re-exported from filenames.js (used by tags)
 *
 * INTERNAL (3 functions - exported for testing, marked with @internal):
 * - readFailedTrackIds() - Read previously failed track IDs
 * - filterTracks() - Categorize tracks for download pipeline
 * - writeFailures() - Append failures to JSONL file
 */

// Re-export filename utilities for backwards compatibility
export {toFilename, toExtension}

// ============================================================================
// Pipeline: Prepare → Filter → Download → Report
// ============================================================================

/**
 * Read failed track IDs from failures.jsonl
 * Returns a Set of track IDs that previously failed to download
 * @internal - exported for testing only
 */
export function readFailedTrackIds(folderPath) {
	const filepath = `${folderPath}/failures.jsonl`

	if (!existsSync(filepath)) {
		return new Set()
	}

	try {
		const content = readFileSync(filepath, 'utf-8').trim()
		if (!content) {
			return new Set()
		}

		const lines = content.split('\n')
		const ids = lines
			.map((line) => {
				try {
					const failure = JSON.parse(line)
					return failure.track?.id
				} catch {
					return null
				}
			})
			.filter(Boolean)

		return new Set(ids)
	} catch {
		return new Set()
	}
}

/**
 * Prepare tracks with filesystem metadata
 * Enriches track objects with file paths and existence status
 */
function prepareTracks(tracks, folderPath) {
	return tracks.map((track) => ({
		...track,
		filename: toFilename(track),
		filepath: toFilepath(track, folderPath),
		fileExists: existsSync(toFilepath(track, folderPath))
	}))
}

/**
 * Filter tracks into download pipeline stages
 * Returns categorized track lists for reporting and processing
 * @internal - exported for testing only
 */
export function filterTracks(
	tracks,
	{force = false, failedIds = new Set()} = {}
) {
	const unavailable = tracks.filter((t) => t.mediaNotAvailable)
	const existing = tracks.filter((t) => t.fileExists)
	const previouslyFailed = tracks.filter((t) => failedIds.has(t.id))
	const toDownload = force
		? tracks
		: tracks.filter(
				(t) => !t.mediaNotAvailable && !t.fileExists && !failedIds.has(t.id)
			)

	return {unavailable, existing, previouslyFailed, toDownload}
}

/**
 * Download a batch of tracks with progress reporting
 * Returns summary of successes and failures
 */
async function downloadBatch(tracks, folderPath, options = {}) {
	const {
		dryRun = false,
		verbose = false,
		writeMetadata = true,
		concurrency = 3
	} = options
	const successes = []
	const failures = []

	// Validate and clamp concurrency
	const clampedConcurrency = Math.max(1, Math.min(10, concurrency))

	// Sequential processing for dry run
	if (dryRun) {
		for (const [index, track] of tracks.entries()) {
			// Only show first 3 tracks for dry run
			if (index < 3) {
				console.log(`  ${track.title}`)
			}
			successes.push(track)
		}

		// Show "more" indicator for dry run
		if (tracks.length > 3) {
			console.log(`  [...${tracks.length - 3} more]`)
		}

		return {successes, failures}
	}

	// Parallel processing for actual downloads
	const limit = pLimit(clampedConcurrency)

	const downloadPromises = tracks.map((track, index) =>
		limit(async () => {
			const progress = `[${index + 1}/${tracks.length}]`

			try {
				await downloadTrack(track, folderPath, {verbose})

				if (writeMetadata) {
					await writeTrackMetadata(track, {verbose})
				}

				await writeTrackMetadataFile(track, {verbose})

				await setFileTimestamps(track.filepath, track, {verbose})

				const txtFilepath = track.filepath.replace(/\.[^.]+$/, '.txt')
				await setFileTimestamps(txtFilepath, track, {verbose})

				console.log(progress, 'Downloaded:', track.filepath)
				successes.push(track)
			} catch (error) {
				console.error(progress, 'Failed:', track.title)
				verbose && console.error(error.message)

				const failure = {track, error: error.message}
				failures.push(failure)

				// Write failure immediately to JSONL file
				await writeFailures([failure], folderPath, {verbose})
			}
		})
	)

	await Promise.all(downloadPromises)

	return {successes, failures}
}

/**
 * Complete download pipeline for a channel
 * Orchestrates: prepare → filter → download → report
 */
export async function downloadChannel(tracks, folderPath, options = {}) {
	const {
		force = false,
		dryRun = false,
		verbose = false,
		concurrency = 3,
		retryFailed = false
	} = options

	// Ensure folder exists
	if (!dryRun) {
		await mkdir(folderPath, {recursive: true})
		await mkdir(`${folderPath}/tracks`, {recursive: true})
	}

	// Pipeline: Prepare
	const prepared = prepareTracks(tracks, folderPath)

	// Read previously failed track IDs (unless retrying)
	const failedIds = retryFailed ? new Set() : readFailedTrackIds(folderPath)

	// Pipeline: Filter
	const {unavailable, existing, previouslyFailed, toDownload} = filterTracks(
		prepared,
		{force, failedIds}
	)

	// Report what we found
	if (dryRun) {
		// Concise output for dry run
		console.log(`Would download ${toDownload.length} tracks:`)
	} else {
		console.log('Total tracks:', tracks.length)
		console.log('  Unavailable:', unavailable.length)
		console.log('  Already exists:', existing.length)
		if (previouslyFailed.length > 0) {
			console.log('  Previously failed:', previouslyFailed.length)
		}
		console.log('  To download:', toDownload.length)
		console.log('  Concurrency:', Math.max(1, Math.min(10, concurrency)))
		console.log()
	}

	// Pipeline: Download
	const {successes, failures} = await downloadBatch(toDownload, folderPath, {
		dryRun,
		verbose,
		writeMetadata: options.writeMetadata !== false, // default true
		concurrency
	})

	// Pipeline: Report
	return {
		total: tracks.length,
		unavailable: unavailable.length,
		existing: existing.length,
		previouslyFailed: previouslyFailed.length,
		downloaded: successes.length,
		failed: failures.length,
		failures
	}
}

// ============================================================================
// Core Download Functions
// ============================================================================

/**
 * Download a single track using yt-dlp
 * Spawns yt-dlp process and handles output/errors
 */
async function downloadTrack(track, folderPath, {verbose = false} = {}) {
	const filename = toFilename(track)
	const extension = toExtension(track)

	const args = [
		'--extract-audio',
		`--format=bestaudio[ext=${extension}]/best[ext=mp4]/best`,
		'--embed-metadata',
		'--no-playlist',
		`--paths=${folderPath}/tracks`,
		`--output=${filename}.%(ext)s`,
		track.url
	]

	if (!verbose) {
		args.push('--quiet')
	}

	return spawnYtDlp(args, {verbose})
}

/**
 * Spawn yt-dlp process
 * Returns a promise that resolves/rejects based on exit code
 */
function spawnYtDlp(args, {verbose = false} = {}) {
	return new Promise((resolve, reject) => {
		const process = spawn('yt-dlp', args)
		const errors = []

		if (verbose) {
			process.stdout.on('data', (data) => {
				console.log('[yt-dlp]', data.toString())
			})
		}

		process.stderr.on('data', (data) => {
			errors.push(data.toString())
		})

		process.on('close', (code) => {
			if (code === 0) {
				resolve()
			} else {
				reject(
					new Error(errors.join('\n') || `yt-dlp exited with code ${code}`)
				)
			}
		})

		process.on('error', reject)
	})
}

// ============================================================================
// Metadata Utilities
// ============================================================================

/**
 * Write metadata to downloaded track file
 * Extracts artist/title and embeds track description
 */
async function writeTrackMetadata(track, {verbose = false} = {}) {
	if (!track.filepath || !existsSync(track.filepath)) {
		throw new Error(`File not found: ${track.filepath}`)
	}

	// Extract artist and title from track.title
	const artistTitle = getArtistTitle(track.title)
	const [artist, title] = artistTitle || [null, null]

	if (!artistTitle && verbose) {
		console.log('Could not parse artist/title from:', track.title)
	}

	// Build description from track description and discogs URL
	let description = ''
	if (track.description || track.discogs_url) {
		const parts = [track.description, track.discogs_url].filter(Boolean)
		description = parts.join('; ')
	}

	// Metadata to write
	const metadata = {
		artist: artist || '',
		title: title || track.title,
		description: description || '',
		comment: '' // Empty comment overwrites yt-dlp defaults
	}

	return new Promise((resolve, reject) => {
		ffmetadata.write(track.filepath, metadata, (error) => {
			if (error) {
				return reject(error)
			}
			resolve()
		})
	})
}

/**
 * Write track metadata as a .txt file
 * Uses the same text format as `r4 track list --format text`
 */
async function writeTrackMetadataFile(track, {verbose = false} = {}) {
	if (!track.filepath) {
		throw new Error('Track filepath required')
	}

	// Create .txt filepath (same name, different extension)
	const txtFilepath = track.filepath.replace(/\.[^.]+$/, '.txt')

	// Use the same formatter as track list command
	const content = formatTrackText(track)

	await writeFile(txtFilepath, content, 'utf-8')

	if (verbose) {
		console.log('Wrote metadata file:', txtFilepath)
	}

	return txtFilepath
}

/**
 * Set file timestamps to match track dates
 * Sets mtime to updated_at and atime to created_at
 */
async function setFileTimestamps(filepath, track, {verbose = false} = {}) {
	if (!existsSync(filepath)) {
		throw new Error(`File not found: ${filepath}`)
	}

	// Use track timestamps if available, otherwise use current time
	const atime = track.updated_at ? new Date(track.updated_at) : new Date()
	const mtime = track.created_at ? new Date(track.created_at) : new Date()

	await utimes(filepath, atime, mtime)

	if (verbose) {
		console.log('Set timestamps:', filepath)
	}
}

// ============================================================================
// Channel Context Files
// ============================================================================

/**
 * Write channel about file (named after channel slug)
 * Uses the same text format as `r4 channel view --format text`
 */
export async function writeChannelAbout(
	channel,
	tracks,
	folderPath,
	{verbose = false} = {}
) {
	const filepath = `${folderPath}/${channel.slug}.txt`

	// Use the same formatter as channel view command
	let content = formatChannelText(channel)

	// Add download-specific information
	content += `

Stats:
  Tracks: ${tracks.length}

Quick Access:
  image.url     # Channel image URL
  tracks.m3u    # Playlist for streaming
  <track>.txt   # Individual track metadata
`

	await writeFile(filepath, content, 'utf-8')

	if (verbose) {
		console.log(`Wrote ${channel.slug}.txt:`, filepath)
	}

	return filepath
}

/**
 * Write channel image.url file
 * Creates a file containing the channel's image URL
 */
export async function writeChannelImageUrl(
	channel,
	folderPath,
	{verbose = false} = {}
) {
	const filepath = `${folderPath}/image.url`

	let content = ''
	if (channel.image) {
		// If it's already a full URL, use as-is
		if (channel.image.startsWith('http')) {
			content = `${channel.image}\n`
		} else {
			// Construct full Cloudinary URL from ID
			content = `${createCloudinaryImageUrl(channel.image)}\n`
		}
	}

	await writeFile(filepath, content, 'utf-8')

	if (verbose) {
		console.log('Wrote image.url:', filepath)
	}

	return filepath
}

/**
 * Write tracks.m3u playlist file
 * Creates an M3U playlist with all track URLs
 */
export async function writeTracksPlaylist(
	tracks,
	folderPath,
	{verbose = false} = {}
) {
	const filepath = `${folderPath}/tracks.m3u`

	let content = '#EXTM3U\n'
	for (const track of tracks) {
		content += `#EXTINF:-1,${track.title || 'Untitled'}\n`
		content += `${track.url}\n`
	}

	await writeFile(filepath, content, 'utf-8')

	if (verbose) {
		console.log('Wrote tracks.m3u:', filepath)
	}

	return filepath
}

/**
 * Write failures to failures.jsonl file
 * Each line is a JSON object with track and error info
 * JSONL format allows easy appending without parsing the whole file
 * @internal - exported for testing only
 */
export async function writeFailures(
	failures,
	folderPath,
	{verbose = false} = {}
) {
	if (failures.length === 0) {
		return null
	}

	const filepath = `${folderPath}/failures.jsonl`
	const timestamp = new Date().toISOString()

	// Write each failure as a separate line
	for (const failure of failures) {
		const line = JSON.stringify({
			timestamp,
			track: {
				id: failure.track.id,
				title: failure.track.title,
				url: failure.track.url,
				youtubeId: extractYouTubeId(failure.track.url)
			},
			error: failure.error
		})

		await appendFile(filepath, `${line}\n`, 'utf-8')
	}

	if (verbose) {
		console.log(`Wrote ${failures.length} failures to:`, filepath)
	}

	return filepath
}

// ============================================================================
// Filename Utilities
// ============================================================================

/**
 * Create full filepath for track
 * Combines folder, filename, and extension
 * Places tracks in a 'tracks/' subfolder
 */
function toFilepath(track, folderPath) {
	const filename = toFilename(track)
	const extension = toExtension(track)
	return `${folderPath}/tracks/${filename}.${extension}`
}
