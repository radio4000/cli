const spawn = require('child_process').spawn
const fs = require('fs')
const sanitizeFilename = require('sanitize-filename')
const { mediaUrlParser } = require('media-url-parser')
const { writeTrackMetadata } = require('./write-track-metadata')

/**
 * Downloads a list of tracks to local files
 * @param {Array<object>} tracks
 * @param {string} folder
 * @param {{debug: boolean, dryrun: boolean, forceDownload: boolean}} options
 */
const downloadTracks = async (
	tracks,
	folder,
	{ dryrun, debug, forceDownload }
) => {
	// Add a few more properties to the tracks.
	tracks = tracks.map(track => {
		track.filename = sanitizeFilename(track.title)
		const parsedTrack = mediaUrlParser(track.url)
		track.extension = parsedTrack.provider === 'soundcloud' ? 'wav' : 'm4a'
		track.destination = `./${folder}/${track.filename}.${track.extension}`
		track.fileExists = fs.existsSync(track.destination)
		return track
	})

	// Get an overview
	const notAvailable = tracks.filter(t => t.mediaNotAvailable)
	const alreadyDownloaded = tracks.filter(t => t.fileExists)
	console.log('- total tracks', tracks.length)
	console.log('- track media not available', notAvailable.length)
	console.log('- tracks already downloaded', alreadyDownloaded.length)
	const toDownload = forceDownload ? tracks : tracks.filter(t => !t.mediaNotAvailable && !t.fileExists)
	console.log('- tracks to download', toDownload.length)

	// Store failures here to be able to report later.
	const failures = []

	for (const [index, track] of toDownload.entries()) {
		try {
			if (!dryrun) {
				await downloadTrack(track.url, folder, track.filename, debug)
				await writeTrackMetadata(track.destination, track, debug)
			} else if (debug) {
				console.log('would download', track.filename, track.url)
			}
			console.log(`${index + 1}/${toDownload.length}`, 'Saved', track.destination)
		} catch (error) {
			console.log('Warning: could not download track', track.url, track.title)
			debug && console.error(error)
			failures.push({ track, error })
			// This is to skip the following code of this for loop occurence. So not add metadata etc.
			continue
		}
	}

	return {
		notAvailable,
		alreadyDownloaded,
		toDownload,
		failures
	}
}

/**
 * Saves a URL to a file
 * @param {string} url  - the url to download
 * @param {string} folder - the folder to save the file in, relative from where the script is run
 * @param {string} filename - the desired filename without extension
 * @param {boolean} debug
 * @returns
 */
const downloadTrack = (url, folder, filename, debug) => {
	const defaultOptions = [
		'--extract-audio',
		`--format=bestaudio[ext=${'m4a'}]/best[ext=mp4]/best`,
		'--embed-metadata',
		'--no-playlist', // If URL points to a playlist, download only the video
		`--paths=${folder}`,
		`--output=${filename}.%(ext)s`
	]

	if (!debug) defaultOptions.push('--quiet')

	// Append the media url to download
	const opts = defaultOptions.concat(url)

	return new Promise((resolve, reject) => {
		const cmd = spawn('yt-dlp', opts)
		cmd.stdout.on('data', data => {
			console.log('stdout', data.toString())
		})
		cmd.stderr.on('data', data => {
			reject(data.toString())
		})
		cmd.on('close', () => {
			resolve(cmd)
		})
	})
}

module.exports = downloadTracks
