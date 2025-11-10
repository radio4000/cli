import {readFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {sdk} from '@radio4000/sdk'
import fuzzysort from 'fuzzysort'
import * as config from './config.js'
import {channelSchema, trackSchema} from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// V1 data paths
const V1_CHANNELS_PATH = resolve(__dirname, '../../data/channels_v1.json')
const V1_TRACKS_PATH = resolve(__dirname, '../../data/tracks_v1.json')

// Cache for v1 data
let v1ChannelsCache = null
let v1TracksCache = null

// ===== HELPERS =====

const mergeVersions = async (v2Fn, v1Data, combiner) => {
	try {
		const v2Result = await v2Fn()
		return combiner ? combiner(v2Result, v1Data) : v2Result
	} catch {
		return v1Data
	}
}

const mergeBySlug = (v2Items, v1Items) => {
	const v2Slugs = new Set(v2Items.map((item) => item.slug))
	return [...v2Items, ...v1Items.filter((item) => !v2Slugs.has(item.slug))]
}

const takeMaybe = (limit) => (items) =>
	limit ? items.slice(0, limit) : items

const parseAsChannel = (source) => (item) =>
	channelSchema.parse({...item, source})

const parseAsTrack = (source) => (item) =>
	trackSchema.parse({...item, source})

const validateTracks = (source) => (items) => {
	const results = items.map((item) => {
		const parsed = trackSchema.safeParse({...item, source})
		return {
			success: parsed.success,
			data: parsed.success ? parsed.data : null,
			error: parsed.success
				? null
				: {
						id: item.id,
						title: item.title,
						url: item.url,
						message: parsed.error.errors[0]?.message || parsed.error.message
					}
		}
	})

	const valid = results.filter((r) => r.success).map((r) => r.data)
	const invalid = results.filter((r) => !r.success).map((r) => r.error)

	return {data: valid, errors: invalid}
}

const reportTrackErrors = (errors) => {
	if (errors.length === 0) return
	console.error(`Warning: Skipped ${errors.length} invalid track(s):`)
	errors.forEach((e) => {
		console.error(`  "${e.title}"`)
		console.error(`    URL: ${e.url}`)
		console.error(`    Reason: ${e.message}`)
		console.error(`    Fix: r4 track edit ${e.id}`)
	})
}

const channelNotFound = (slugs) => {
	const error = new Error(
		`Channel${slugs.length > 1 ? 's' : ''} not found: ${slugs.join(', ')}`
	)
	error.code = 'CHANNEL_NOT_FOUND'
	error.statusCode = 404
	return error
}

const rejectV1Mutation = (type, id) => {
	throw new Error(
		`Cannot modify v1 ${type}: ${id}. This is a read-only archived ${type}.`
	)
}

// ===== V1 DATA LOADERS =====

export async function loadV1Channels() {
	if (v1ChannelsCache) return v1ChannelsCache
	const content = await readFile(V1_CHANNELS_PATH, 'utf-8')
	v1ChannelsCache = JSON.parse(content).map((item) =>
		channelSchema.parse({...item, source: 'v1'})
	)
	return v1ChannelsCache
}

export async function loadV1Tracks() {
	if (v1TracksCache) return v1TracksCache
	const content = await readFile(V1_TRACKS_PATH, 'utf-8')
	v1TracksCache = JSON.parse(content)
		.map((item) => {
			try {
				return trackSchema.parse({...item, source: 'v1'})
			} catch {
				return null
			}
		})
		.filter(Boolean)
	return v1TracksCache
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
	const v1Channels = await loadV1Channels()
	const limitTo = takeMaybe(options.limit)

	return mergeVersions(
		async () => {
			const {data, error} = await sdk.channels.readChannels()
			if (error) throw error
			return data.map(parseAsChannel('v2'))
		},
		limitTo(v1Channels),
		(v2Channels, v1) => limitTo(mergeBySlug(v2Channels, v1))
	)
}

export async function getChannel(slug) {
	try {
		const {data, error} = await sdk.channels.readChannel(slug)
		if (error) throw error
		return channelSchema.parse({...data, source: 'v2'})
	} catch {
		const channel = (await loadV1Channels()).find((ch) => ch.slug === slug)
		if (!channel) throw new Error(`Channel not found: ${slug}`)
		return channel
	}
}

export async function createChannel(data) {
	await requireAuth()
	const {data: channel, error} = await sdk.channels.createChannel(data)
	if (error) throw error
	return channelSchema.parse({...channel, source: 'v2'})
}

export async function updateChannel(slug, updates) {
	await requireAuth()
	const channel = await getChannel(slug)
	if (channel.source === 'v1') rejectV1Mutation('channel', slug)

	const {error} = await sdk.channels.updateChannel(channel.id, updates)
	if (error) throw error

	// Fetch the updated channel since updateChannel doesn't return the full object
	return await getChannel(slug)
}

export async function deleteChannel(slug) {
	await requireAuth()
	const channel = await getChannel(slug)
	if (channel.source === 'v1') rejectV1Mutation('channel', slug)

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

	const v1Tracks = await loadV1Tracks()
	const v1Slugs = new Set((await loadV1Channels()).map((ch) => ch.slug))
	const limitTo = takeMaybe(maxItems)
	const filterBySlugs = (tracks) =>
		tracks.filter((tr) => channelSlugs.includes(tr.slug))

	const ensureChannelsExist = (v2Slugs = new Set()) => {
		const missing = channelSlugs.filter(
			(s) => !v1Slugs.has(s) && !v2Slugs.has(s)
		)
		if (missing.length) throw channelNotFound(missing)
	}

	const fetchV2Tracks = async () => {
		const {data: channels} = await sdk.channels.readChannels()
		const v2Slugs = new Set(channels?.map((ch) => ch.slug) || [])
		ensureChannelsExist(v2Slugs)

		const rawTracks = await Promise.all(
			channelSlugs.map(async (slug) => {
				const {data, error} = await sdk.channels.readChannelTracks(slug)
				if (error) throw error
				return data
			})
		).then((results) => results.flat())

		return validateTracks('v2')(rawTracks)
	}

	try {
		const {data: v2Tracks, errors} = await fetchV2Tracks()
		reportTrackErrors(errors)
		return limitTo([...v2Tracks, ...filterBySlugs(v1Tracks)])
	} catch (error) {
		if (error.code === 'CHANNEL_NOT_FOUND') throw error
		ensureChannelsExist()
		return limitTo(filterBySlugs(v1Tracks))
	}
}

export async function getTrack(id) {
	try {
		const {data, error} = await sdk.tracks.readTrack(id)
		if (error) throw error
		return trackSchema.parse({...data, source: 'v2'})
	} catch {
		const track = (await loadV1Tracks()).find((tr) => tr.id === id)
		if (!track) throw new Error(`Track not found: ${id}`)
		return track
	}
}

export async function createTrack(data) {
	await requireAuth()

	const channelId =
		data.channel_id || (data.slug ? (await getChannel(data.slug)).id : null)
	if (!channelId) throw new Error('channel_id or channel slug required')

	const {data: track, error} = await sdk.tracks.createTrack(channelId, data)
	if (error) throw error
	return trackSchema.parse({...track, source: 'v2'})
}

export async function updateTrack(id, updates) {
	await requireAuth()
	const track = await getTrack(id)
	if (track.source === 'v1') rejectV1Mutation('track', id)

	const {error} = await sdk.tracks.updateTrack(id, updates)
	if (error) throw error

	// Fetch the updated track since updateTrack doesn't return the full object
	return await getTrack(id)
}

export async function deleteTrack(id) {
	await requireAuth()
	const track = await getTrack(id)
	if (track.source === 'v1') rejectV1Mutation('track', id)

	const {data, error} = await sdk.tracks.deleteTrack(id)
	if (error) throw error
	return data
}

/** @param {string} query */
export async function searchChannels(query, options = {}) {
	const v1Channels = await loadV1Channels()
	const limitTo = takeMaybe(options.limit)

	const fuzzySearch = (channels) =>
		fuzzysort
			.go(query, channels, {
				keys: ['slug', 'name', 'description'],
				all: false,
				limit: options.limit
			})
			.map((r) => r.obj)

	const textSearch = async () => {
		const {data, error} = await sdk.supabase
			.from('channels')
			.select()
			.textSearch('fts', `'${query}':*`)
		if (error) throw new Error(error.message)
		return data.map(parseAsChannel('v2'))
	}

	return mergeVersions(
		textSearch,
		fuzzySearch(v1Channels),
		(v2Results, v1Results) => limitTo(mergeBySlug(v2Results, v1Results))
	)
}

export async function searchTracks(query, options = {}) {
	const v1Tracks = await loadV1Tracks()
	const limitTo = takeMaybe(options.limit)

	const fuzzySearch = (tracks) =>
		fuzzysort
			.go(query, tracks, {
				keys: ['title', 'description'],
				all: false,
				limit: options.limit
			})
			.map((r) => r.obj)

	const textSearch = async () => {
		const {data, error} = await sdk.supabase
			.from('channel_tracks')
			.select()
			.textSearch('fts', `'${query}':*`)
		if (error) throw new Error(error.message)
		return data.map(parseAsTrack('v2'))
	}

	return mergeVersions(
		textSearch,
		fuzzySearch(v1Tracks),
		(v2Results, v1Results) => limitTo([...v2Results, ...v1Results])
	)
}

export async function searchAll(query, options = {}) {
	const [channels, tracks] = await Promise.all([
		searchChannels(query, options),
		searchTracks(query, options)
	])
	return {channels, tracks}
}
