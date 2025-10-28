import {readFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {channelSchema, trackSchema} from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// V1 data paths
const V1_CHANNELS_PATH = resolve(__dirname, '../data/channels_v1.json')
const V1_TRACKS_PATH = resolve(__dirname, '../data/tracks_v1.json')

// Cache for v1 data
let v1ChannelsCache = null
let v1TracksCache = null

/**
 * Load v1 channels from bundled JSON
 * @returns {Promise<Array>}
 */
async function loadV1Channels() {
	if (v1ChannelsCache) {
		return v1ChannelsCache
	}

	const content = await readFile(V1_CHANNELS_PATH, 'utf-8')
	const channels = JSON.parse(content)
	v1ChannelsCache = channels.map((ch) => channelSchema.parse(ch))
	return v1ChannelsCache
}

/**
 * Load v1 tracks from bundled JSON
 * @returns {Promise<Array>}
 */
async function loadV1Tracks() {
	if (v1TracksCache) {
		return v1TracksCache
	}

	const content = await readFile(V1_TRACKS_PATH, 'utf-8')
	const tracks = JSON.parse(content)
	v1TracksCache = tracks.map((tr) => trackSchema.parse(tr))
	return v1TracksCache
}

/**
 * Data source with v2 API and v1 fallback
 */
export class DataSource {
	constructor(config = {}) {
		this.apiUrl =
			config.apiUrl || process.env.R4_API_URL || 'https://api.radio4000.com'
		this.authToken = config.authToken || process.env.R4_AUTH_TOKEN
	}

	/**
	 * Check if authenticated for write operations
	 */
	isAuthenticated() {
		return !!this.authToken
	}

	/**
	 * Ensure user is authenticated for write operations
	 */
	requireAuth() {
		if (!this.isAuthenticated()) {
			throw new Error('Authentication required. Run: r4 auth login')
		}
	}

	/**
	 * Make API request to v2
	 */
	async apiRequest(endpoint, options = {}) {
		const url = `${this.apiUrl}${endpoint}`
		const headers = {
			'Content-Type': 'application/json',
			...(this.authToken ? {Authorization: `Bearer ${this.authToken}`} : {}),
			...options.headers
		}

		const response = await fetch(url, {
			...options,
			headers
		})

		if (!response.ok) {
			const error = await response.text().catch(() => response.statusText)
			throw new Error(`API request failed: ${response.status} ${error}`)
		}

		return response.json()
	}

	// ===== CHANNEL OPERATIONS =====

	/**
	 * List all channels (v2 with v1 fallback)
	 */
	async listChannels() {
		try {
			// Try v2 API first
			const channels = await this.apiRequest('/channels')
			return channels.map((ch) => channelSchema.parse({...ch, source: 'v2'}))
		} catch (error) {
			// Fall back to v1 bundled data
			console.warn('API unavailable, using bundled v1 data')
			return await loadV1Channels()
		}
	}

	/**
	 * Get a channel by slug (v2 with v1 fallback)
	 */
	async getChannel(slug) {
		try {
			// Try v2 API first
			const channel = await this.apiRequest(`/channels/${slug}`)
			return channelSchema.parse({...channel, source: 'v2'})
		} catch (error) {
			// Fall back to v1 bundled data
			const v1Channels = await loadV1Channels()
			const channel = v1Channels.find((ch) => ch.slug === slug)
			if (!channel) {
				throw new Error(`Channel not found: ${slug}`)
			}
			return channel
		}
	}

	/**
	 * Create a new channel (v2 only)
	 */
	async createChannel(data) {
		this.requireAuth()
		const channel = await this.apiRequest('/channels', {
			method: 'POST',
			body: JSON.stringify(data)
		})
		return channelSchema.parse({...channel, source: 'v2'})
	}

	/**
	 * Update a channel (v2 only)
	 */
	async updateChannel(slug, data) {
		this.requireAuth()

		// Check if it's a v1 channel
		const channel = await this.getChannel(slug)
		if (channel.source === 'v1') {
			throw new Error(
				`Cannot modify v1 channel: ${slug}. This is a read-only archived channel.`
			)
		}

		const updated = await this.apiRequest(`/channels/${slug}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		})
		return channelSchema.parse({...updated, source: 'v2'})
	}

	/**
	 * Delete a channel (v2 only)
	 */
	async deleteChannel(slug) {
		this.requireAuth()

		// Check if it's a v1 channel
		const channel = await this.getChannel(slug)
		if (channel.source === 'v1') {
			throw new Error(
				`Cannot delete v1 channel: ${slug}. This is a read-only archived channel.`
			)
		}

		await this.apiRequest(`/channels/${slug}`, {
			method: 'DELETE'
		})
		return {success: true, slug}
	}

	// ===== TRACK OPERATIONS =====

	/**
	 * List tracks (v2 with v1 fallback)
	 * @param {Object} filters - { channelSlugs?: string[] }
	 */
	async listTracks(filters = {}) {
		try {
			// Try v2 API first
			let endpoint = '/tracks'
			if (filters.channelSlugs && filters.channelSlugs.length > 0) {
				const params = new URLSearchParams()
				filters.channelSlugs.forEach((slug) => params.append('channel', slug))
				endpoint += `?${params.toString()}`
			}
			const tracks = await this.apiRequest(endpoint)
			return tracks.map((tr) => trackSchema.parse({...tr, source: 'v2'}))
		} catch (error) {
			// Fall back to v1 bundled data
			console.warn('API unavailable, using bundled v1 data')
			let tracks = await loadV1Tracks()

			// Filter by channel slugs if requested
			if (filters.channelSlugs && filters.channelSlugs.length > 0) {
				tracks = tracks.filter((tr) => filters.channelSlugs.includes(tr.slug))
			}

			return tracks
		}
	}

	/**
	 * Get a track by ID (v2 with v1 fallback)
	 */
	async getTrack(id) {
		try {
			// Try v2 API first
			const track = await this.apiRequest(`/tracks/${id}`)
			return trackSchema.parse({...track, source: 'v2'})
		} catch (error) {
			// Fall back to v1 bundled data
			const v1Tracks = await loadV1Tracks()
			const track = v1Tracks.find((tr) => tr.id === id)
			if (!track) {
				throw new Error(`Track not found: ${id}`)
			}
			return track
		}
	}

	/**
	 * Create a new track (v2 only)
	 */
	async createTrack(data) {
		this.requireAuth()
		const track = await this.apiRequest('/tracks', {
			method: 'POST',
			body: JSON.stringify(data)
		})
		return trackSchema.parse({...track, source: 'v2'})
	}

	/**
	 * Update a track (v2 only)
	 */
	async updateTrack(id, data) {
		this.requireAuth()

		// Check if it's a v1 track
		const track = await this.getTrack(id)
		if (track.source === 'v1') {
			throw new Error(
				`Cannot modify v1 track: ${id}. This is a read-only archived track.`
			)
		}

		const updated = await this.apiRequest(`/tracks/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(data)
		})
		return trackSchema.parse({...updated, source: 'v2'})
	}

	/**
	 * Delete a track (v2 only)
	 */
	async deleteTrack(id) {
		this.requireAuth()

		// Check if it's a v1 track
		const track = await this.getTrack(id)
		if (track.source === 'v1') {
			throw new Error(
				`Cannot delete v1 track: ${id}. This is a read-only archived track.`
			)
		}

		await this.apiRequest(`/tracks/${id}`, {
			method: 'DELETE'
		})
		return {success: true, id}
	}
}

/**
 * Create a data source instance with optional config
 */
export function createDataSource(config) {
	return new DataSource(config)
}
