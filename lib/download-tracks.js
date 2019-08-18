const spawn = require('child_process').spawn
const fs = require('fs')
const ffmetadata = require('ffmetadata')
const sanitizeFilename = require('sanitize-filename')
const getArtistTitle = require('get-artist-title')

const downloadTracks = async (tracks, downloadFolderName, options = {}) => {
	const {debugOutput, forceDownload, forceMediaAvailableCheck} = options
	const fileExtension = 'm4a'

	// For each track to download, download and edit its data
	// We first save the track by its r4-id, so it is easier to manipulate
	// Finally we rename it to the user defined title in r4
	for (let index = 0; index < tracks.length; index++) {
		const currentTrack = tracks[index]
		const trackFilePath = `./${downloadFolderName}/${currentTrack.id}.${fileExtension}`
		const fileName = sanitizeFilename(currentTrack.title)
		const newTrackFilePath = `./${downloadFolderName}/${fileName}.${fileExtension}`

		const mediaNotAvailable = currentTrack.mediaNotAvailable
		const fileExists = fs.existsSync(newTrackFilePath)

		const shouldDownload = () => {
			if (forceDownload) return true
			if (forceMediaAvailableCheck && !fileExists) {
				debugOutput && console.log('Media available check forced', newTrackFilePath)
				return true
			}
			if (mediaNotAvailable) {
				debugOutput && console.log('Media marked as not available, skiping download', newTrackFilePath)
				return false
			}
			if (fileExists) {
				debugOutput && console.log('Track exists, not downloading', newTrackFilePath)
				return false
			}
			// if not stated otherwise, should always fetch missing local media
			return true
		}

		if (shouldDownload()) {
			const trackToDownload = {
				origin: currentTrack.url,
				destination: trackFilePath,
				extension: fileExtension,
				debug: debugOutput
			}
			/* eslint-disable no-await-in-loop */
			// https://eslint.org/docs/rules/no-await-in-loop#when-not-to-use-it
			try {
				if (debugOutput) {
					console.log('Fetching', trackToDownload.origin, newTrackFilePath)
				}
				await downloadTrack(trackToDownload)
			} catch (error) {
				console.log('Warning: could not download track', newTrackFilePath)
				// This is to skip the following code of this for loop occurence
				// So not add metadata etc.
				continue
			}

			await addTrackMetadata(trackFilePath, newTrackFilePath, currentTrack)

			await renameTrack(trackFilePath, newTrackFilePath)
			/* eslint-enable no-await-in-loop */

			if (debugOutput) {
				console.log('Added metadata and renamed temporary file', newTrackFilePath)
			}

			// Index + 1, since we start from 0 till tracks.length in the for loop abv
			console.log(`${index + 1}/${tracks.length}`, 'Saved', newTrackFilePath)
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
// Doc: origin=url, destination=path minus ext, extension=file extension, debug=shouldDebug
const downloadTrack = ({origin, destination, extension, debug}) => {

	const defaultOptions = [
		'--no-playlist', // If URL points to a video in a playlist, only take the video
		'--no-warnings',
		`--format=bestaudio[ext=${extension}]/best[ext=mp4]/best`,
		'--extract-audio',
		`--output=${destination}`,
		'--no-call-home',
		'--ignore-errors', // Continue on errors
		'--audio-quality=0',
		'--add-metadata'
		// 'write-thumbnail ',
	]
	// Put media url to download at the end of the options
	const opts = defaultOptions.concat(origin)

	return new Promise((resolve, reject) => {
		const cmd = spawn('youtube-dl', opts)
		cmd.stdout.on('data', data => {
			if (debug) {
				console.log(`${data}`)
			}
		})

		cmd.stderr.on('data', data => {
			if (debug) {
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
