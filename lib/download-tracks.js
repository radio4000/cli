const spawn = require('child_process').spawn
const fs = require('fs')
const ffmetadata = require('ffmetadata')
const sanitizeFilename = require('sanitize-filename')
const getArtistTitle = require('get-artist-title')

const downloadTracks = async (tracks, downloadFolderName, options = {}) => {
	const {forceDownload} = options
	const fileExtension = 'm4a'

	// For each track to download, download and edit its data
	// We first save the track by its r4-id, so it is easier to manipulate
	// Finally we rename it to the user defined title in r4
	for (let index = 0; index < tracks.length; index++) {
		const currentTrack = tracks[index]
		const trackFilePath = `./${downloadFolderName}/${currentTrack.id}.${fileExtension}`
		const fileName = sanitizeFilename(currentTrack.title)
		const newTrackFilePath = `./${downloadFolderName}/${fileName}.${fileExtension}`

		const fileExists = fs.existsSync(newTrackFilePath)
		const skipDownload = fileExists && !forceDownload

		if (!skipDownload) {

			/* eslint-disable no-await-in-loop */
			// https://eslint.org/docs/rules/no-await-in-loop#when-not-to-use-it
			try {
				await downloadTrack(currentTrack.url, trackFilePath, fileExtension)
			} catch (error) {
				console.log('Warning: could not download track', newTrackFilePath)
				continue
			}

			await addTrackMetadata(trackFilePath, newTrackFilePath, currentTrack)

			await renameTrack(trackFilePath, newTrackFilePath)
			/* eslint-enable no-await-in-loop */

			console.log(`${index}/${tracks.length}`, 'Saved', newTrackFilePath)
		} else {
			console.log('Track exists, not downloading it', newTrackFilePath)
		}
	}
}

// Add meta data
// And overwrite the one we don't want
const addTrackMetadata = async (trackFilePath, newTrackFilePath, track) => {
	const [artist, title] = getArtistTitle(track.title)
	let description

	// Create a description
	if (track.body || track.discogsUrl) {
		const discogsUrl = track.discogsUrl || ''
		description = `${track.body}; ${discogsUrl}`.trim()
	}

	// See https://www.npmjs.com/package/ffmetadata#metadata
	// Seems `comment` as empty string is necessary,
	// To overwrite descriptions
	const newMetaData = {
		artist,
		title,
		description: description || '',
		comment: ''
	}

	// Return a promise to be be manage async
	return new Promise(resolve => {
		return ffmetadata.write(trackFilePath, newMetaData, metaDataWriteError => {
			if (metaDataWriteError) {
				console.error('Error writing metadata', metaDataWriteError)
			}

			resolve()
		})
	})
}

// Rename file to ./channel/r4-track-title.ext
// This will overwite wxisting file
const renameTrack = async (oldTrackFilePath, newTrackFilePath) => {
	await fs.renameSync(oldTrackFilePath, newTrackFilePath)
}

// Use youtube-dl on a media
// and save it to a provided location
const downloadTrack = (trackUrl, trackFilePath, fileExt) => {
	const defaultOptions = [
		'--no-playlist', // If URL points to a video in a playlist, only take the video
		'--no-warnings',
		`--format=bestaudio[ext=${fileExt}]/best[ext=mp4]/best`,
		'--extract-audio',
		`--output=${trackFilePath}`,
		'--no-call-home',
		'--ignore-errors', // Continue on errors
		'--audio-quality=0',
		'--add-metadata'
		// 'write-thumbnail ',
	]
	// Put media url to download at the end of the options
	const opts = defaultOptions.concat(trackUrl)

	return new Promise((resolve, reject) => {
		const cmd = spawn('youtube-dl', opts)
		const verboseOutput = false
		cmd.stdout.on('data', data => {
			if (verboseOutput) {
				console.log(`${data}`)
			}
		})

		cmd.stderr.on('data', data => {
			if (verboseOutput) {
				console.error(`${data}`)
			}
			reject(data)
		})

		cmd.on('close', () => {
			resolve(cmd)
		})
	})
}

module.exports = downloadTracks
