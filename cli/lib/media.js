/**
 * Media provider utilities
 * Functions for detecting and parsing media URLs (YouTube, SoundCloud, etc.)
 */

/**
 * Extract YouTube video ID from URL
 * Supports youtube.com, youtu.be, and embedded formats
 * @param {string} url - YouTube URL
 * @returns {string|null} YouTube video ID or null if not found
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
 * @param {string} url - Media URL
 * @returns {'youtube'|'soundcloud'|null} Provider name or null
 */
export function detectMediaProvider(url) {
	if (!url) return null
	if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube'
	if (url.includes('soundcloud.com')) return 'soundcloud'
	return null
}
