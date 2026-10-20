import {execFile, spawn} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {
	appendFile,
	mkdir,
	rename,
	rm,
	utimes,
	writeFile
} from 'node:fs/promises'
import {promisify} from 'node:util'
import ffmetadata from 'ffmetadata'
import getArtistTitle from 'get-artist-title'
import {toExtension, toFilename} from './filenames.js'
import {channelToText, trackToText} from './formatters.js'
import {createCloudinaryImageUrl} from './images.js'
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
 * INTERNAL (exported for testing, marked with @internal):
 * - readFailures() - Read every entry from failures.jsonl
 * - readFailedTrackIds() - Read previously failed track IDs
 * - classifyFailure() - Sort a yt-dlp error into why it failed
 * - findBrokenTracks() - Pick tracks whose download failed for good
 * - filterTracks() - Categorize tracks for download pipeline
 * - writeFailures() - Append failures to JSONL file
 */

// Re-export filename utilities for backwards compatibility
export {toExtension, toFilename}

// ============================================================================
// Pipeline: Prepare → Filter → Download → Report
// ============================================================================

/**
 * Read every entry from failures.jsonl, oldest first
 * Skips lines that aren't valid JSON
 * @internal - exported for testing only
 */
export function readFailures(folderPath) {
	const filepath = `${folderPath}/failures.jsonl`

	if (!existsSync(filepath)) {
		return []
	}

	try {
		const content = readFileSync(filepath, 'utf-8').trim()
		if (!content) {
			return []
		}

		return content
			.split('\n')
			.map((line) => {
				try {
					return JSON.parse(line)
				} catch {
					return null
				}
			})
			.filter((failure) => failure?.track?.id)
	} catch {
		return []
	}
}

/**
 * Read IDs of tracks whose current URL failed to download before
 * A replaced URL (e.g. fixed in doctor) counts as new, so it downloads again
 * @internal - exported for testing only
 */
export function readFailedTrackIds(folderPath, tracks) {
	const urls = new Map(tracks.map((track) => [track.id, track.url]))
	return new Set(
		readFailures(folderPath)
			.filter((failure) => urls.get(failure.track.id) === failure.track.url)
			.map((failure) => failure.track.id)
	)
}

/**
 * Sort a yt-dlp error into why the download failed
 * - 'unavailable', 'private': the video is gone for everyone
 * - 'region': blocked where you are, may play elsewhere
 * - 'transient': bot checks, rate limits, network, disk - worth retrying
 * @internal - exported for testing only
 */
export function classifyFailure(error = '') {
	if (/try again later/i.test(error)) return 'transient'
	if (/in your country/i.test(error)) return 'region'
	if (/Private video/i.test(error)) return 'private'
	if (
		/Video unavailable|This video is unavailable|no longer available|has been removed|removed following|blocked due to the claimed content|blocked it on copyright grounds|Incomplete YouTube ID/i.test(
			error
		)
	) {
		return 'unavailable'
	}
	return 'transient'
}

/**
 * Pick tracks whose latest download failure means the video is gone for everyone
 * Expects prepared tracks (fileExists). Skips tracks that have since downloaded,
 * changed URL, or already have a playback_error
 * Returns [{track, playback_error}] with playback_error like 'ytdlp:unavailable'
 * @internal - exported for testing only
 */
export function findBrokenTracks(tracks, failures) {
	// Later lines win, so each track keeps its most recent failure
	const latest = new Map(failures.map((failure) => [failure.track.id, failure]))

	return tracks.flatMap((track) => {
		const failure = latest.get(track.id)
		if (!failure || track.playback_error || track.fileExists) return []
		if (failure.track.url !== track.url) return []

		const reason = classifyFailure(failure.error)
		if (reason !== 'unavailable' && reason !== 'private') return []
		return [{track, playback_error: `ytdlp:${reason}`}]
	})
}

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
 * @internal - exported for testing only
 */
export function filterTracks(
	tracks,
	{force = false, failedIds = new Set()} = {}
) {
	// Marked by --mark-broken: the video is gone. Errors from the web player
	// (e.g. youtube:150, embedding disabled) can still download, so they don't count
	const isUnavailable = (t) => t.playback_error?.startsWith('ytdlp:')
	const unavailable = tracks.filter(isUnavailable)
	const existing = tracks.filter((t) => t.fileExists)
	const previouslyFailed = tracks.filter(
		(t) => failedIds.has(t.id) && !isUnavailable(t)
	)
	const toDownload = force
		? tracks
		: tracks.filter(
				(t) => !isUnavailable(t) && !t.fileExists && !failedIds.has(t.id)
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
		concurrency = 3,
		cookiesFromBrowser
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
				await downloadTrack(track, `${folderPath}/tracks`, {
					verbose,
					cookiesFromBrowser
				})

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
	const failedIds = retryFailed
		? new Set()
		: readFailedTrackIds(folderPath, tracks)

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
		concurrency,
		cookiesFromBrowser: options.cookiesFromBrowser
	})

	const upgrade = options.upgrade
		? await upgradeTracks(existing, folderPath, {
				dryRun,
				verbose,
				concurrency,
				cookiesFromBrowser: options.cookiesFromBrowser,
				recheck: options.recheck
			})
		: null

	// Pipeline: Report
	return {
		upgrade,
		total: tracks.length,
		unavailable: unavailable.length,
		existing: existing.length,
		previouslyFailed: previouslyFailed.length,
		downloaded: successes.length,
		failed: failures.length,
		failures,
		tracks: prepared
	}
}

// ============================================================================
// Core Download Functions
// ============================================================================

// Below this a YouTube m4a is the free ~128kbps format, worth trying to upgrade
const UPGRADE_BELOW_BITRATE = 200_000
// YouTube rarely adds 256kbps later, so "no better format" holds for a while
const RECHECK_AFTER_DAYS = 180

/**
 * Media IDs that had no better format in the last RECHECK_AFTER_DAYS,
 * from upgrades.jsonl
 * @internal - exported for testing only
 */
export function readRecentNoBetter(folderPath, now = Date.now()) {
	const filepath = `${folderPath}/upgrades.jsonl`
	if (!existsSync(filepath)) return new Set()
	const cutoff = now - RECHECK_AFTER_DAYS * 24 * 60 * 60 * 1000
	const ids = new Set()
	for (const line of readFileSync(filepath, 'utf-8').split('\n')) {
		try {
			const entry = JSON.parse(line)
			if (Date.parse(entry.checked_at) > cutoff) ids.add(entry.media_id)
		} catch {}
	}
	return ids
}

/**
 * Replace existing ~128kbps YouTube files with format 141 (256kbps AAC) where
 * YouTube has it. Downloads to a temp folder first, so the original stays if
 * anything goes wrong.
 * @internal - exported for testing only
 */
export async function upgradeTracks(tracks, folderPath, options = {}) {
	const {
		dryRun,
		verbose,
		concurrency = 3,
		cookiesFromBrowser,
		recheck
	} = options
	const tmpDir = `${folderPath}/.upgrade`
	const limit = pLimit(Math.max(1, Math.min(10, concurrency)))
	const result = {
		checked: 0,
		upgraded: 0,
		best: 0,
		unknown: 0,
		noBetter: 0,
		checkedRecently: 0,
		failed: 0,
		stopped: null
	}

	// Local bitrate check first, so we only ask YouTube about ~128kbps files
	const candidates = []
	const recentNoBetter = recheck ? new Set() : readRecentNoBetter(folderPath)
	const youtubeTracks = tracks.filter((t) => {
		if (t.provider !== 'youtube' || !t.filepath.endsWith('.m4a')) return false
		if (!recentNoBetter.has(t.media_id)) return true
		result.checkedRecently++
		return false
	})
	console.log()
	console.log(`Checking bitrate of ${youtubeTracks.length} existing tracks…`)
	await Promise.all(
		youtubeTracks.map((track) =>
			limit(async () => {
				result.checked++
				const bitrate = await probeBitrate(track.filepath)
				if (!bitrate) result.unknown++
				else if (bitrate >= UPGRADE_BELOW_BITRATE) result.best++
				else candidates.push(track)
			})
		)
	)

	console.log(
		`${dryRun ? 'Would try to upgrade' : 'Upgrading'} ${candidates.length} of ${result.checked} existing tracks`
	)
	if (dryRun || !candidates.length) return result

	await mkdir(tmpDir, {recursive: true})

	await Promise.all(
		candidates.map((track, index) =>
			limit(async () => {
				if (result.stopped) return
				const progress = `[${index + 1}/${candidates.length}]`
				const tmpFile = `${tmpDir}/${toFilename(track)}.m4a`
				try {
					await downloadTrack(track, tmpDir, {
						verbose,
						cookiesFromBrowser,
						format: '141'
					})
					await writeTrackMetadata({...track, filepath: tmpFile}, {verbose})
					await setFileTimestamps(tmpFile, track, {verbose})
					await rename(tmpFile, track.filepath)
					result.upgraded++
					console.log(progress, 'Upgraded:', track.filepath)
				} catch (error) {
					await rm(tmpFile, {force: true})
					// These hit every remaining track, so stop instead of failing them all
					if (/PO Token/.test(error.message)) {
						result.stopped = 'no PO token, see warning above'
					} else if (/rate-limited/.test(error.message)) {
						result.stopped = 'rate-limited by YouTube, try again in an hour'
					} else if (/Requested format is not available/.test(error.message)) {
						result.noBetter++
						console.log(progress, 'No better format:', track.title)
						await appendFile(
							`${folderPath}/upgrades.jsonl`,
							`${JSON.stringify({media_id: track.media_id, checked_at: new Date().toISOString(), result: 'no-better'})}\n`
						)
					} else {
						result.failed++
						console.error(
							progress,
							'Upgrade failed:',
							track.title,
							`(${ytDlpError(error.message)})`
						)
						verbose && console.error(error.message)
					}
				}
			})
		)
	)

	await rm(tmpDir, {recursive: true, force: true})
	return result
}

/**
 * The reason from yt-dlp's last ERROR line, without the "[youtube] id:" prefix
 */
function ytDlpError(stderr) {
	const line = stderr.split('\n').findLast((l) => l.startsWith('ERROR:'))
	return (
		line?.replace(/^ERROR: (\[[^\]]+\] )?([\w-]{11}: )?/, '') || stderr.trim()
	)
}

/**
 * Read the audio bitrate of a file with ffprobe, 0 if unknown
 */
async function probeBitrate(filepath) {
	try {
		const args = '-v error -select_streams a:0 -show_entries stream=bit_rate'
		const {stdout} = await promisify(execFile)('ffprobe', [
			...args.split(' '),
			...['-of', 'csv=p=0', filepath]
		])
		return Number(stdout.trim()) || 0
	} catch {
		return 0
	}
}

/**
 * Download a single track using yt-dlp
 * Spawns yt-dlp process and handles output/errors
 */
async function downloadTrack(
	track,
	tracksDir,
	{verbose = false, cookiesFromBrowser, format} = {}
) {
	const filename = toFilename(track)
	const extension = toExtension(track)

	const args = [
		'--extract-audio',
		// 141 is 256kbps AAC, only served to YouTube Premium accounts
		`--format=${format || `141/bestaudio[ext=${extension}]/best[ext=mp4]/best`}`,
		'--embed-metadata',
		'--no-playlist',
		`--paths=${tracksDir}`,
		`--output=${filename}.%(ext)s`
	]

	if (cookiesFromBrowser) {
		args.push(`--cookies-from-browser=${cookiesFromBrowser}`)
	}

	// yt-dlp only uses the web_music client (where 141 lives) for music.youtube.com URLs
	if (cookiesFromBrowser && track.provider === 'youtube' && track.media_id) {
		args.push(`https://music.youtube.com/watch?v=${track.media_id}`)
	} else {
		args.push(track.url)
	}

	if (!verbose) {
		args.push('--quiet')
	}

	return spawnYtDlp(args, {verbose})
}

let warnedPoToken = false

/**
 * Premium formats need a PO token, which yt-dlp can't make on its own.
 * Warn once per run instead of silently falling back to ~128kbps.
 */
function warnPoToken(stderr) {
	if (warnedPoToken || !/PO Token/.test(stderr)) return
	warnedPoToken = true
	console.warn(
		'⚠ yt-dlp needs a PO token for YouTube Premium formats, falling back to lower quality.'
	)
	console.warn(
		'  Install the bgutil plugin: https://github.com/Brainicism/bgutil-ytdlp-pot-provider'
	)
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
			warnPoToken(errors.join(''))
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
 * Write backup.json with local file paths for downloaded tracks
 * Format matches ChannelBackup: { version, created_at, channel, tracks[] }
 * Tracks with local files get relative path as url; failed tracks keep original url
 */
export async function writeBackupJson(
	channel,
	tracks,
	folderPath,
	{verbose = false, baseUrl = ''} = {}
) {
	const filepath = `${folderPath}/download.json`
	const prefix = baseUrl ? `${baseUrl.replace(/\/$/, '')}/tracks` : 'tracks'

	const backupTracks = tracks.map((track) => {
		// Strip internal enrichment fields before writing
		const {filename, filepath, fileExists, ...cleanTrack} = track

		if (fileExists || existsSync(filepath)) {
			const ext = toExtension(track)
			const name = filename || toFilename(track)
			return {
				...cleanTrack,
				url: `${prefix}/${encodeURIComponent(`${name}.${ext}`)}`,
				provider: 'file',
				media_id: null
			}
		}
		return cleanTrack
	})

	const backup = {
		version: 2,
		created_at: new Date().toISOString(),
		channel,
		tracks: backupTracks
	}

	await writeFile(filepath, JSON.stringify(backup, null, '\t'), 'utf-8')

	if (verbose) {
		console.log('Wrote download.json:', filepath)
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
				media_id: failure.track.media_id
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
