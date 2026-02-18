import {sdk} from '@radio4000/sdk'
import * as config from './config.js'
import {channelSchema, trackSchema} from './schema.js'

// ===== HELPERS =====

const takeMaybe = (limit) => (items) => (limit ? items.slice(0, limit) : items)

const channelNotFound = (slugs) => {
	const error = new Error(
		`Channel${slugs.length > 1 ? 's' : ''} not found: ${slugs.join(', ')}`
	)
	error.code = 'CHANNEL_NOT_FOUND'
	error.statusCode = 404
	return error
}

// ===== AUTH HELPERS =====

export async function requireAuth() {
	const data = await config.load()
	const session = data.auth?.session

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
	const {data, error} = await sdk.channels.readChannels()
	if (error) throw error
	return takeMaybe(options.limit)(data.map((ch) => channelSchema.parse(ch)))
}

export async function getChannel(slug) {
	const {data, error} = await sdk.channels.readChannel(slug)
	if (error) throw error
	return channelSchema.parse(data)
}

export async function createChannel(data) {
	await requireAuth()
	const {data: channel, error} = await sdk.channels.createChannel(data)
	if (error) throw error
	return channelSchema.parse(channel)
}

export async function updateChannel(slug, updates) {
	await requireAuth()
	const channel = await getChannel(slug)

	const {error} = await sdk.channels.updateChannel(channel.id, updates)
	if (error) throw error

	// Fetch the updated channel since updateChannel doesn't return the full object
	return await getChannel(slug)
}

export async function deleteChannel(slug) {
	await requireAuth()
	const channel = await getChannel(slug)

	const {data, error} = await sdk.channels.deleteChannel(channel.id)
	if (error) throw error
	return data
}

// ===== TRACK OPERATIONS =====

export async function listTracks(options = {}) {
	const {channelSlugs, limit: maxItems} = options

	if (!channelSlugs?.length) {
		throw new Error(
			'channelSlugs required. Specify at least one channel to list tracks from.'
		)
	}

	const {data: channels} = await sdk.channels.readChannels()
	const knownSlugs = new Set(channels?.map((ch) => ch.slug) || [])
	const missing = channelSlugs.filter((s) => !knownSlugs.has(s))
	if (missing.length) throw channelNotFound(missing)

	const rawTracks = await Promise.all(
		channelSlugs.map(async (slug) => {
			const {data, error} = await sdk.channels.readChannelTracks(slug)
			if (error) throw error
			return data
		})
	).then((results) => results.flat())

	const tracks = rawTracks.map((t) => trackSchema.parse(t))
	tracks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
	return takeMaybe(maxItems)(tracks)
}

export async function getTrack(id) {
	const {data, error} = await sdk.tracks.readTrack(id)
	if (error) throw error
	return trackSchema.parse(data)
}

export async function createTrack(data) {
	await requireAuth()

	const channelId =
		data.channel_id || (data.slug ? (await getChannel(data.slug)).id : null)
	if (!channelId) throw new Error('channel_id or channel slug required')

	const {data: track, error} = await sdk.tracks.createTrack(channelId, data)
	if (error) throw error
	return trackSchema.parse(track)
}

export async function updateTrack(id, updates) {
	await requireAuth()

	const {error} = await sdk.tracks.updateTrack(id, updates)
	if (error) throw error

	// Fetch the updated track since updateTrack doesn't return the full object
	return await getTrack(id)
}

export async function deleteTrack(id) {
	await requireAuth()

	const {data, error} = await sdk.tracks.deleteTrack(id)
	if (error) throw error
	return data
}

/** @param {string} query */
export async function searchChannels(query, options = {}) {
	const {data, error} = await sdk.supabase
		.from('channels')
		.select()
		.textSearch('fts', `'${query}':*`)
	if (error) throw new Error(error.message)
	return takeMaybe(options.limit)(data.map((ch) => channelSchema.parse(ch)))
}

export async function searchTracks(query, options = {}) {
	const {data, error} = await sdk.supabase
		.from('channel_tracks')
		.select()
		.textSearch('fts', `'${query}':*`)
	if (error) throw new Error(error.message)
	return takeMaybe(options.limit)(data.map((t) => trackSchema.parse(t)))
}

export async function searchAll(query, options = {}) {
	const [channels, tracks] = await Promise.all([
		searchChannels(query, options),
		searchTracks(query, options)
	])
	return {channels, tracks}
}
