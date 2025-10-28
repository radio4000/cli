import {readFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {sdk} from '@radio4000/sdk'
import fuzzysort from 'fuzzysort'
import {getValidSession} from './auth.js'
import {channelSchema, trackSchema} from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// V1 data paths
const V1_CHANNELS_PATH = resolve(__dirname, '../data/channels_v1.json')
const V1_TRACKS_PATH = resolve(__dirname, '../data/tracks_v1.json')

// Cache for v1 data
let v1ChannelsCache = null
let v1TracksCache = null

// ===== V1 DATA LOADERS =====

export async function loadV1Channels() {
	if (v1ChannelsCache) return v1ChannelsCache

	const content = await readFile(V1_CHANNELS_PATH, 'utf-8')
	const channels = JSON.parse(content)
	v1ChannelsCache = channels.map((ch) =>
		channelSchema.parse({...ch, source: 'v1'})
	)
	return v1ChannelsCache
}

export async function loadV1Tracks() {
	if (v1TracksCache) return v1TracksCache

	const content = await readFile(V1_TRACKS_PATH, 'utf-8')
	const tracks = JSON.parse(content)
	// Filter out invalid tracks (v1 data may have empty/invalid URLs)
	v1TracksCache = tracks
		.map((tr) => {
			try {
				return trackSchema.parse({...tr, source: 'v1'})
			} catch {
				return null // Skip invalid tracks
			}
		})
		.filter(Boolean)
	return v1TracksCache
}

// ===== AUTH HELPERS =====

export async function getAuthToken() {
	const session = await getValidSession()
	return session?.access_token || null
}

export async function requireAuth() {
	const session = await getValidSession()

	if (!session) {
		throw new Error('Authentication required. Run: r4 auth login')
	}

	// Set the session in SDK
	await sdk.supabase.auth.setSession({
		access_token: session.access_token,
		refresh_token: session.refresh_token
	})

	return session.access_token
}

// ===== CHANNEL OPERATIONS =====

export async function listChannels(options = {}) {
	const {limit} = options

	// Always load v1 channels
	const v1Channels = await loadV1Channels()

	try {
		// Try to get v2 channels
		const {data: v2Data, error} = await sdk.channels.readChannels()
		if (error) throw new Error(error)

		const v2Channels = v2Data.map((ch) =>
			channelSchema.parse({...ch, source: 'v2'})
		)

		// Combine: v2 takes priority over v1 for duplicate slugs
		const v2Slugs = new Set(v2Channels.map((ch) => ch.slug))
		const v1Only = v1Channels.filter((ch) => !v2Slugs.has(ch.slug))
		const combined = [...v2Channels, ...v1Only]

		return limit ? combined.slice(0, limit) : combined
	} catch (_error) {
		// Silent fallback to v1 - this is expected during migration
		return limit ? v1Channels.slice(0, limit) : v1Channels
	}
}

export async function getChannel(slug) {
	try {
		const {data: channel, error} = await sdk.channels.readChannel(slug)
		if (error) throw new Error(error)
		return channelSchema.parse({...channel, source: 'v2'})
	} catch (_error) {
		// Fall back to v1
		const v1Channels = await loadV1Channels()
		const channel = v1Channels.find((ch) => ch.slug === slug)
		if (!channel) {
			throw new Error(`Channel not found: ${slug}`)
		}
		return channel
	}
}

export async function createChannel(data) {
	await requireAuth()
	const {data: channel, error} = await sdk.channels.createChannel(data)
	if (error) throw new Error(error)
	return channelSchema.parse({...channel, source: 'v2'})
}

export async function updateChannel(slug, updates) {
	await requireAuth()

	// Check if it's a v1 channel (read-only)
	const channel = await getChannel(slug)
	if (channel.source === 'v1') {
		throw new Error(
			`Cannot modify v1 channel: ${slug}. This is a read-only archived channel.`
		)
	}

	const {data: updated, error} = await sdk.channels.updateChannel(
		channel.id,
		updates
	)
	if (error) throw new Error(error)
	return channelSchema.parse({...updated, source: 'v2'})
}

export async function deleteChannel(slug) {
	await requireAuth()

	// Check if it's a v1 channel (read-only)
	const channel = await getChannel(slug)
	if (channel.source === 'v1') {
		throw new Error(
			`Cannot delete v1 channel: ${slug}. This is a read-only archived channel.`
		)
	}

	const {error} = await sdk.channels.deleteChannel(channel.id)
	if (error) throw new Error(error)
	return {success: true, slug}
}

// ===== TRACK OPERATIONS =====

const applyLimit = (limit) => (items) => (limit ? items.slice(0, limit) : items)

const parseTrack = (source) => (tr) => trackSchema.parse({...tr, source})

const fetchChannelTracks = async (slug) => {
	const {data: tracks, error} = await sdk.channels.readChannelTracks(slug)
	if (error) throw new Error(error)
	return tracks
}

export async function listTracks(options = {}) {
	const {channelSlugs, limit} = options
	const limitTo = applyLimit(limit)

	// Require channelSlugs
	if (!channelSlugs || channelSlugs.length === 0) {
		throw new Error(
			'channelSlugs required. Specify at least one channel to list tracks from.'
		)
	}

	// Always load v1 tracks
	const v1Tracks = await loadV1Tracks()

	try {
		// Fetch v2 tracks for specified channels
		const rawTracks = (
			await Promise.all(channelSlugs.map(fetchChannelTracks))
		).flat()
		const invalidTracks = []

		const v2Tracks = rawTracks
			.map((tr) => {
				try {
					return parseTrack('v2')(tr)
				} catch (error) {
					// Collect invalid tracks for reporting
					invalidTracks.push({
						id: tr.id,
						title: tr.title,
						url: tr.url,
						error: error.errors?.[0]?.message || error.message
					})
					return null
				}
			})
			.filter(Boolean)

		// Log warning about invalid tracks
		if (invalidTracks.length > 0) {
			console.error(
				`Warning: Skipped ${invalidTracks.length} invalid track(s):`
			)
			invalidTracks.forEach((t) => {
				console.error(`  "${t.title}"`)
				console.error(`    URL: ${t.url}`)
				console.error(`    Reason: ${t.error}`)
				console.error(`    Fix: r4 track edit ${t.id}`)
			})
		}

		// Combine v2 + v1 tracks
		// Note: v1 tracks from migrated channels have been pre-cleaned, so no deduplication needed
		const combined = [...v2Tracks, ...v1Tracks]

		// Filter by channel slugs
		const filtered = combined.filter((tr) => channelSlugs.includes(tr.slug))

		return limitTo(filtered)
	} catch (_error) {
		// Silent fallback to v1 - this is expected during migration
		const filtered = v1Tracks.filter((tr) => channelSlugs.includes(tr.slug))

		return limitTo(filtered)
	}
}

export async function getTrack(id) {
	try {
		const {data: track, error} = await sdk.tracks.readTrack(id)
		if (error) throw new Error(error)
		return trackSchema.parse({...track, source: 'v2'})
	} catch (_error) {
		// Fall back to v1
		const v1Tracks = await loadV1Tracks()
		const track = v1Tracks.find((tr) => tr.id === id)
		if (!track) {
			throw new Error(`Track not found: ${id}`)
		}
		return track
	}
}

export async function createTrack(data) {
	await requireAuth()

	// We need the channel_id for the SDK
	// If data has channel slug, we need to look it up
	let channelId = data.channel_id
	if (!channelId && data.slug) {
		const channel = await getChannel(data.slug)
		channelId = channel.id
	}

	if (!channelId) {
		throw new Error('channel_id or channel slug required')
	}

	const {data: track, error} = await sdk.tracks.createTrack(channelId, data)
	if (error) throw new Error(error)
	return trackSchema.parse({...track, source: 'v2'})
}

export async function updateTrack(id, updates) {
	await requireAuth()

	// Check if it's a v1 track (read-only)
	const track = await getTrack(id)
	if (track.source === 'v1') {
		throw new Error(
			`Cannot modify v1 track: ${id}. This is a read-only archived track.`
		)
	}

	const {data: updated, error} = await sdk.tracks.updateTrack(id, updates)
	if (error) throw new Error(error)
	return trackSchema.parse({...updated, source: 'v2'})
}

export async function deleteTrack(id) {
	await requireAuth()

	// Check if it's a v1 track (read-only)
	const track = await getTrack(id)
	if (track.source === 'v1') {
		throw new Error(
			`Cannot delete v1 track: ${id}. This is a read-only archived track.`
		)
	}

	const {error} = await sdk.tracks.deleteTrack(id)
	if (error) throw new Error(error)
	return {success: true, id}
}

// ===== AUTH OPERATIONS =====

export async function signIn(email, password) {
	const {data, error} = await sdk.auth.signIn({email, password})
	if (error) throw new Error(error)
	return data
}

export async function signOut() {
	const {error} = await sdk.auth.signOut()
	if (error) throw new Error(error)
	return {success: true}
}

export async function readUser() {
	const token = getAuthToken()
	if (!token) return null

	const {data, error} = await sdk.users.readUser(token)
	if (error) throw new Error(error)
	return data
}

// ===== SEARCH OPERATIONS =====

export async function searchChannels(query, options = {}) {
	const {limit, threshold = -10000} = options

	// Always load v1 for fallback/supplement
	const v1Channels = await loadV1Channels()

	try {
		// Use SDK full-text search on API
		const {data, error} = await sdk.supabase
			.from('channels')
			.select()
			.textSearch('fts', `'${query}':*`)

		if (error) throw new Error(error.message)

		// Parse API results
		const apiResults = data.map((ch) =>
			channelSchema.parse({...ch, source: 'v2'})
		)

		// Also do fuzzy search on v1 data
		const v1Results = fuzzysort
			.go(query, v1Channels, {
				keys: ['slug', 'name', 'description'],
				threshold,
				all: false
			})
			.map((r) => r.obj)

		// Combine: API first, then v1 results not already in API
		const apiSlugs = new Set(apiResults.map((ch) => ch.slug))
		const v1Only = v1Results.filter((ch) => !apiSlugs.has(ch.slug))
		const combined = [...apiResults, ...v1Only]

		return limit ? combined.slice(0, limit) : combined
	} catch (_error) {
		// Silent fallback to v1 fuzzy search - this is expected during migration
		const results = fuzzysort.go(query, v1Channels, {
			keys: ['slug', 'name', 'description'],
			limit,
			threshold,
			all: false
		})
		return results.map((r) => r.obj)
	}
}

export async function searchTracks(query, options = {}) {
	const {limit, threshold = -10000} = options

	// Always load v1 for fallback/supplement
	const v1Tracks = await loadV1Tracks()

	try {
		// Use SDK full-text search on API (channel_tracks table)
		const {data, error} = await sdk.supabase
			.from('channel_tracks')
			.select()
			.textSearch('fts', `'${query}':*`)

		if (error) throw new Error(error.message)

		// Parse API results
		const apiResults = data.map((tr) =>
			trackSchema.parse({...tr, source: 'v2'})
		)

		// Also do fuzzy search on v1 data
		const v1Results = fuzzysort
			.go(query, v1Tracks, {
				keys: ['title', 'description'],
				threshold,
				all: false
			})
			.map((r) => r.obj)

		// Combine: API first, then v1 results
		// Note: v1 tracks from migrated channels are already cleaned, minimal overlap expected
		const combined = [...apiResults, ...v1Results]

		return limit ? combined.slice(0, limit) : combined
	} catch (_error) {
		// Silent fallback to v1 fuzzy search - this is expected during migration
		const results = fuzzysort.go(query, v1Tracks, {
			keys: ['title', 'description'],
			limit,
			threshold,
			all: false
		})
		return results.map((r) => r.obj)
	}
}

export async function searchAll(query, options = {}) {
	const {limit} = options

	const [channels, tracks] = await Promise.all([
		searchChannels(query, options),
		searchTracks(query, options)
	])

	return {
		channels: limit ? channels.slice(0, limit) : channels,
		tracks: limit ? tracks.slice(0, limit) : tracks
	}
}
