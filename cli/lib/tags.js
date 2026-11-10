/**
 * Tag utilities for extracting and organizing tags from tracks
 * Tags are stored as hashtags in track.description (e.g., "#ambient #drone")
 */
import {extractTokens} from '@radio4000/sdk'

/**
 * Extract tags from a string (typically track.description or track.body), the
 * same way the database fills track.tags (sdk extractTokens).
 * @param {string} text - Text to extract tags from
 * @returns {string[]} Lowercase tags without the # prefix
 */
export function extractTags(text) {
	return extractTokens(text).tags
}

/**
 * Get normalized tags from a track object
 * Uses parsed tags array if available, otherwise extracts from description/body
 * @param {object} track - Track object with tags, description, or body
 * @returns {string[]} Array of normalized lowercase tags
 */
function getTrackTags(track) {
	if (track.tags && Array.isArray(track.tags)) {
		return track.tags.map((t) => t.toLowerCase())
	}
	const text = track.description || track.body || ''
	return extractTags(text)
}

/**
 * Get unique tags from a list of tracks with their occurrence count
 * @param {Array<{tags?: string[], description?: string, body?: string}>} tracks - Array of track objects
 * @returns {{tags: string[], sortedTags: Array<[string, number]>, tagMap: Map<string, number>}}
 */
export function getUniqueTags(tracks) {
	if (!Array.isArray(tracks)) {
		return {tags: [], sortedTags: [], tagMap: new Map()}
	}

	const tagCounts = new Map()

	for (const track of tracks) {
		const tags = getTrackTags(track)

		for (const tag of tags) {
			tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
		}
	}

	// Get unique tags as sorted array
	const tags = Array.from(tagCounts.keys()).sort((a, b) => a.localeCompare(b))

	// Get tags sorted by occurrence (descending)
	const sortedTags = Array.from(tagCounts.entries()).sort((a, b) => {
		// Sort by count descending, then alphabetically
		const countDiff = b[1] - a[1]
		return countDiff !== 0 ? countDiff : a[0].localeCompare(b[0])
	})

	return {
		tags, // Alphabetically sorted tags
		sortedTags, // Tags sorted by count: [['ambient', 42], ['drone', 25], ...]
		tagMap: tagCounts // Map for quick lookup
	}
}

/**
 * Get tracks that have specific tags
 * @param {Array<{tags?: string[], description?: string, body?: string}>} tracks - Array of track objects
 * @param {string[]} filterTags - Tags to filter by
 * @param {boolean} matchAll - If true, track must have all tags; if false, any tag matches
 * @returns {Array} Filtered tracks
 */
export function filterTracksByTags(tracks, filterTags, matchAll = false) {
	if (!Array.isArray(tracks) || !Array.isArray(filterTags)) {
		return []
	}

	const normalizedFilterTags = filterTags.map((t) => t.toLowerCase())

	return tracks.filter((track) => {
		const trackTags = getTrackTags(track)

		if (matchAll) {
			// Track must have all filter tags
			return normalizedFilterTags.every((filterTag) =>
				trackTags.includes(filterTag)
			)
		} else {
			// Track must have at least one filter tag
			return normalizedFilterTags.some((filterTag) =>
				trackTags.includes(filterTag)
			)
		}
	})
}
