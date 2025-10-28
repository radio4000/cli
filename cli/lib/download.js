import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {mkdir, utimes, writeFile} from 'node:fs/promises'
import ffmetadata from 'ffmetadata'
import filenamify from 'filenamify'
import getArtistTitle from 'get-artist-title'

/**
 * Download pipeline for Radio4000 tracks
 * Pure functional approach - each function does one thing well
 */

// ============================================================================
// Pipeline: Prepare → Filter → Download → Report
// ============================================================================

/**
 * Prepare tracks with filesystem metadata
 * Enriches track objects with file paths and existence status
 */
export function prepareTracks(tracks, folderPath) {
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
 */
export function filterTracks(tracks, {force = false} = {}) {
	const unavailable = tracks.filter((t) => t.mediaNotAvailable)
	const existing = tracks.filter((t) => t.fileExists)
	const toDownload = force
		? tracks
		: tracks.filter((t) => !t.mediaNotAvailable && !t.fileExists)

	return {unavailable, existing, toDownload}
}

/**
 * Download a batch of tracks with progress reporting
 * Returns summary of successes and failures
 */
export async function downloadBatch(tracks, folderPath, options = {}) {
	const {dryRun = false, debug = false, writeMetadata = true} = options
	const successes = []
	const failures = []

	for (const [index, track] of tracks.entries()) {
		const progress = `[${index + 1}/${tracks.length}]`

		try {
			if (dryRun) {
				console.log(progress, 'Would download:', track.title)
				successes.push(track)
				continue
			}

			await downloadTrack(track, folderPath, {debug})

			if (writeMetadata) {
				await writeTrackMetadata(track, {debug})
			}

			await writeTrackMetadataFile(track, {debug})

			await setFileTimestamps(track.filepath, track, {debug})

			const txtFilepath = track.filepath.replace(/\.[^.]+$/, '.txt')
			await setFileTimestamps(txtFilepath, track, {debug})

			console.log(progress, 'Downloaded:', track.filepath)
			successes.push(track)
		} catch (error) {
			console.error(progress, 'Failed:', track.title)
			debug && console.error(error.message)
			failures.push({track, error: error.message})
		}
	}

	return {successes, failures}
}

/**
 * Complete download pipeline for a channel
 * Orchestrates: prepare → filter → download → report
 */
export async function downloadChannel(tracks, folderPath, options = {}) {
	const {force = false, dryRun = false, debug = false} = options

	// Ensure folder exists
	if (!dryRun) {
		await mkdir(folderPath, {recursive: true})
		await mkdir(`${folderPath}/tracks`, {recursive: true})
	}

	// Pipeline: Prepare
	const prepared = prepareTracks(tracks, folderPath)

	// Pipeline: Filter
	const {unavailable, existing, toDownload} = filterTracks(prepared, {force})

	// Report what we found
	console.log('Total tracks:', tracks.length)
	console.log('  Unavailable:', unavailable.length)
	console.log('  Already exists:', existing.length)
	console.log('  To download:', toDownload.length)
	console.log()

	// Pipeline: Download
	const {successes, failures} = await downloadBatch(toDownload, folderPath, {
		dryRun,
		debug,
		writeMetadata: options.writeMetadata !== false // default true
	})

	// Pipeline: Report
	return {
		total: tracks.length,
		unavailable: unavailable.length,
		existing: existing.length,
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
export async function downloadTrack(track, folderPath, {debug = false} = {}) {
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

	if (!debug) {
		args.push('--quiet')
	}

	return spawnYtDlp(args, {debug})
}

/**
 * Spawn yt-dlp process
 * Returns a promise that resolves/rejects based on exit code
 */
function spawnYtDlp(args, {debug = false} = {}) {
	return new Promise((resolve, reject) => {
		const process = spawn('yt-dlp', args)
		const errors = []

		if (debug) {
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
export async function writeTrackMetadata(track, {debug = false} = {}) {
	if (!track.filepath || !existsSync(track.filepath)) {
		throw new Error(`File not found: ${track.filepath}`)
	}

	// Extract artist and title from track.title
	const artistTitle = getArtistTitle(track.title)
	const [artist, title] = artistTitle || [null, null]

	if (!artistTitle && debug) {
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
 * Creates a human-readable text file with track information
 */
export async function writeTrackMetadataFile(track, {debug = false} = {}) {
	if (!track.filepath) {
		throw new Error('Track filepath required')
	}

	// Create .txt filepath (same name, different extension)
	const txtFilepath = track.filepath.replace(/\.[^.]+$/, '.txt')

	// Build description section
	let descriptionSection = ''
	if (track.description) {
		descriptionSection = `\nDescription:\n${track.description}`
	}

	// Build discogs section
	let discogsSection = ''
	if (track.discogs_url) {
		discogsSection = `\nDiscogs: ${track.discogs_url}`
	}

	// Build tags section
	let tagsSection = ''
	if (track.tags && track.tags.length > 0) {
		tagsSection = `\nTags: ${track.tags.map((t) => `#${t}`).join(' ')}`
	}

	// Format timestamps
	let timestampSection = ''
	if (track.created_at) {
		const created = new Date(track.created_at).toLocaleString()
		timestampSection += `\nAdded: ${created}`
	}
	if (track.updated_at) {
		const updated = new Date(track.updated_at).toLocaleString()
		timestampSection += `\nUpdated: ${updated}`
	}

	// Build complete content
	const content = `Title: ${track.title}
URL: ${track.url}${descriptionSection}${discogsSection}${tagsSection}${timestampSection}
`

	await writeFile(txtFilepath, content, 'utf-8')

	if (debug) {
		console.log('Wrote metadata file:', txtFilepath)
	}

	return txtFilepath
}

/**
 * Set file timestamps to match track dates
 * Sets mtime to updated_at and atime to created_at
 */
export async function setFileTimestamps(filepath, track, {debug = false} = {}) {
	if (!existsSync(filepath)) {
		throw new Error(`File not found: ${filepath}`)
	}

	// Use track timestamps if available, otherwise use current time
	const atime = track.updated_at ? new Date(track.updated_at) : new Date()
	const mtime = track.created_at ? new Date(track.created_at) : new Date()

	await utimes(filepath, atime, mtime)

	if (debug) {
		console.log('Set timestamps:', filepath)
	}
}

// ============================================================================
// Channel Context Files
// ============================================================================

/**
 * Write channel ABOUT.txt file
 * Creates a human-readable channel information file
 */
export async function writeChannelAbout(
	channel,
	tracks,
	folderPath,
	{debug = false} = {}
) {
	const filepath = `${folderPath}/ABOUT.txt`

	const titleLine = channel.name || 'Untitled Channel'
	const underline = '='.repeat(titleLine.length)

	const description = channel.description || 'No description available.'

	const createdDate = channel.created_at
		? new Date(channel.created_at).toLocaleDateString()
		: 'Unknown'

	const websiteSection = channel.url ? `  Website: ${channel.url}\n` : ''

	const content = `${titleLine}
${underline}

${description}

Stats:
  Tracks: ${tracks.length}
  Created: ${createdDate}
${websiteSection}
Quick Access:
  image.url     # Channel image URL
  tracks.m3u    # Playlist for streaming
  <track>.txt   # Individual track metadata
`

	await writeFile(filepath, content, 'utf-8')

	if (debug) {
		console.log('Wrote ABOUT.txt:', filepath)
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
	{debug = false} = {}
) {
	const filepath = `${folderPath}/image.url`

	let content = ''
	if (channel.image) {
		// If it's already a full URL (Cloudinary), use as-is
		if (channel.image.startsWith('http')) {
			content = `${channel.image}\n`
		} else {
			// Otherwise construct Supabase storage URL
			// Note: We'd need the supabase URL from config, for now just store the path
			content = `${channel.image}\n`
		}
	}

	await writeFile(filepath, content, 'utf-8')

	if (debug) {
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
	{debug = false} = {}
) {
	const filepath = `${folderPath}/tracks.m3u`

	let content = '#EXTM3U\n'
	for (const track of tracks) {
		content += `#EXTINF:-1,${track.title || 'Untitled'}\n`
		content += `${track.url}\n`
	}

	await writeFile(filepath, content, 'utf-8')

	if (debug) {
		console.log('Wrote tracks.m3u:', filepath)
	}

	return filepath
}

// ============================================================================
// Filename Utilities
// ============================================================================

/**
 * Extract YouTube video ID from URL
 * Supports various YouTube URL formats
 */
export function extractYouTubeId(url) {
	if (!url) return null

	const patterns = [
		/(?:youtube\.com\/\S*(?:(?:\/e(?:mbed))?\/|watch\/?\?(?:\S*?&?v=))|youtu\.be\/)([a-zA-Z0-9_-]{6,11})/
	]

	for (const pattern of patterns) {
		const match = url.match(pattern)
		if (match) return match[1]
	}

	return null
}

/**
 * Detect media provider from URL
 * Returns 'youtube', 'soundcloud', or null
 */
export function detectMediaProvider(url) {
	if (!url) return null
	if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
	if (url.includes('soundcloud.com')) return 'soundcloud'
	return null
}

/**
 * Create safe filename from track (no path, no extension)
 * This is the canonical filename function
 * Format: "Track Title [youtube-id]"
 */
export function toFilename(track) {
	if (!track.title || typeof track.title !== 'string') {
		throw new Error(`Invalid track title: ${JSON.stringify(track.title)}`)
	}

	// Sanitize title first
	const cleanTitle = filenamify(track.title, {
		maxLength: 180 // Leave room for ID suffix
	})

	// Add YouTube ID suffix if available (for uniqueness)
	const ytId = extractYouTubeId(track.url)
	if (ytId) {
		return `${cleanTitle} [${ytId}]`
	}

	return cleanTitle
}

/**
 * Get file extension based on media provider
 * SoundCloud uses mp3, YouTube/others use m4a
 */
export function toExtension(track) {
	if (track.extension) {
		return track.extension
	}

	const provider = detectMediaProvider(track.url)
	return provider === 'soundcloud' ? 'mp3' : 'm4a'
}

/**
 * Create full filepath for track
 * Combines folder, filename, and extension
 * Places tracks in a 'tracks/' subfolder
 */
export function toFilepath(track, folderPath) {
	const filename = toFilename(track)
	const extension = toExtension(track)
	return `${folderPath}/tracks/${filename}.${extension}`
}
