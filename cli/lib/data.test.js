import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {
	getAuthToken,
	getChannel,
	listChannels,
	listTracks,
	loadV1Channels,
	loadV1Tracks,
	requireAuth
} from './data.js'

const originalEnv = process.env.R4_AUTH_TOKEN

beforeEach(() => delete process.env.R4_AUTH_TOKEN)
afterEach(() => {
	originalEnv
		? (process.env.R4_AUTH_TOKEN = originalEnv)
		: delete process.env.R4_AUTH_TOKEN
})

describe('loadV1Channels', () => {
	test('returns array with v1 source', async () => {
		const channels = await loadV1Channels()
		expect(channels.length > 0).toBe(true)
		expect(channels.every((ch) => ch.source === 'v1')).toBe(true)
	})

	test('caches result', async () => {
		const first = await loadV1Channels()
		const second = await loadV1Channels()
		expect(first).toBe(second)
	})
})

describe('loadV1Tracks', () => {
	test('returns array with v1 source', async () => {
		const tracks = await loadV1Tracks()
		expect(tracks.length > 0).toBe(true)
		expect(tracks.every((tr) => tr.source === 'v1')).toBe(true)
	})

	test('all tracks have valid urls', async () => {
		const tracks = await loadV1Tracks()
		expect(tracks.every((tr) => tr.url?.length > 0)).toBe(true)
	})
})

describe('auth', () => {
	test('getAuthToken returns null when unset', () => {
		expect(getAuthToken()).toBeNull()
	})

	test('getAuthToken returns value when set', () => {
		process.env.R4_AUTH_TOKEN = 'test-token'
		expect(getAuthToken()).toBe('test-token')
	})

	test('requireAuth throws when unset', () => {
		expect(() => requireAuth()).toThrow('Authentication required')
	})

	test('requireAuth returns token when set', () => {
		process.env.R4_AUTH_TOKEN = 'test-token'
		expect(requireAuth()).toBe('test-token')
	})
})

describe('listChannels', () => {
	test('returns non-empty array', async () => {
		const channels = await listChannels()
		expect(channels.length > 0).toBe(true)
	})

	test('respects limit', async () => {
		const channels = await listChannels({limit: 5})
		expect(channels.length <= 5).toBe(true)
	})

	test('all have required fields', async () => {
		const channels = await listChannels({limit: 10})
		expect(channels.every((ch) => ch.id && ch.slug && ch.source)).toBe(true)
	})
})

describe('getChannel', () => {
	test('fetches v1 channel', async () => {
		const ch = await getChannel('detecteve')
		expect(ch.slug).toBe('detecteve')
		expect(ch.source).toBe('v1')
	})

	test('fetches v2 channel', async () => {
		const ch = await getChannel('ko002')
		expect(ch.slug).toBe('ko002')
		expect(ch.source).toBe('v2')
	})

	test('throws for non-existent channel', async () => {
		await expect(getChannel('nonexistent-xyz')).rejects.toThrow(
			'Channel not found'
		)
	})
})

describe('listTracks', () => {
	test('returns non-empty array', async () => {
		const tracks = await listTracks({limit: 10})
		expect(tracks.length > 0).toBe(true)
	})

	test('respects limit', async () => {
		const tracks = await listTracks({limit: 5})
		expect(tracks.length <= 5).toBe(true)
	})

	test('all have required fields', async () => {
		const tracks = await listTracks({limit: 10})
		expect(tracks.every((tr) => tr.id && tr.url && tr.source)).toBe(true)
	})

	test('filters by channel slug', async () => {
		const tracks = await listTracks({channelSlugs: ['ko002'], limit: 5})
		expect(tracks.every((tr) => tr.slug === 'ko002')).toBe(true)
	})
})
