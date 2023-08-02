const ffmetadata = require('ffmetadata')
const getArtistTitle = require('get-artist-title')

/**
 * Writes tracks meta data to a file
 * @param {string} filePath
 * @param {object} track - artist and title will be extracted from the track.title
 * @param {boolean} debug
 * @returns {Promise}
 */
const writeTrackMetadata = async (filePath, track, debug) => {
	// Get the artist and title
	let artistTitle = getArtistTitle(track.title) || []
	const [artist, title] = artistTitle
	if (!artistTitle) {
		debug && console.log('Could not find media artist/title from track.title')
	}

	// Create a description
	let description
	if (track.body || track.discogsUrl) {
		const discogsUrl = track.discogsUrl || ''
		description = `${track.body}; ${discogsUrl}`.trim()
	}

	// See https://www.npmjs.com/package/ffmetadata#metadata
	// Seems `comment` as empty string is necessary to overwrite descriptions
	const newMetaData = {
		artist,
		title,
		description: description || '',
		comment: ''
	}

	// Return a promise to be be manage async
	return new Promise(resolve => {
		return ffmetadata.write(filePath, newMetaData, metaDataWriteError => {
			if (metaDataWriteError) return metaDataWriteError
			return resolve()
		})
	})
}

module.exports = { writeTrackMetadata }
