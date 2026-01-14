/**
 * Filename utilities for Radio4000 tracks
 * Functions for generating safe filenames and extensions
 */

import filenamify from 'filenamify'

/**
 * Create safe filename from track (no path, no extension)
 * Format depends on source:
 *   - youtube: "Track Title [youtube-id]"
 *   - soulseek: "Track Title [r4-trackid]"
 * @param {Object} track - Track object with title, url, and optionally id
 * @param {Object} options - Options including source
 * @returns {string} Safe filename
 */
export function toFilename(track, options = {}) {
	const {source = 'youtube'} = options

	if (!track.title || typeof track.title !== 'string') {
		throw new Error(`Invalid track title: ${JSON.stringify(track.title)}`)
	}

	// Sanitize title first
	const cleanTitle = filenamify(track.title, {
		maxLength: 180 // Leave room for ID suffix
	})

	// Add media ID suffix if available (for uniqueness)
	if (track.media_id) {
		return `${cleanTitle} [${track.media_id}]`
	}

	// Soulseek: use r4 track ID for uniqueness
	if (source === 'soulseek') {
			if (track.id) {
					return `${cleanTitle} [r4-${track.id.slice(0, 8)}]`
			}
			return cleanTitle
	}

	return cleanTitle
}

/**
 * Get file extension based on media provider or source
 * - Soulseek: uses extension from search result (flac, mp3, etc.)
 * - SoundCloud: mp3
 * - YouTube/others: m4a
 * @param {Object} track - Track object with url or extension
 * @param {Object} options - Options including source
 * @returns {string} File extension
 */
export function toExtension(track, options = {}) {
	const {source = 'youtube'} = options

	// Explicit extension always wins
	if (track.extension) {
		return track.extension
	}

	// Soulseek: default to flac (actual extension set during download)
	if (source === 'soulseek') {
		return 'flac'
	}

	const provider = detectMediaProvider(track.url)
	return provider === 'soundcloud' ? 'mp3' : 'm4a'
}
