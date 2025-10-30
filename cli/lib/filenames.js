/**
 * Filename utilities for Radio4000 tracks
 * Functions for generating safe filenames and extensions
 */

import filenamify from 'filenamify'
import {detectMediaProvider, extractYouTubeId} from './media.js'

/**
 * Create safe filename from track (no path, no extension)
 * Format: "Track Title [youtube-id]"
 * @param {Object} track - Track object with title and url
 * @returns {string} Safe filename
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
 * @param {Object} track - Track object with url or extension
 * @returns {string} File extension (mp3 or m4a)
 */
export function toExtension(track) {
	if (track.extension) {
		return track.extension
	}

	const provider = detectMediaProvider(track.url)
	return provider === 'soundcloud' ? 'mp3' : 'm4a'
}
