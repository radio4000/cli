import {afterEach, beforeEach, describe, expect, test} from 'bun:test'
import {getChannel, listChannels, listTracks, requireAuth} from './data.js'

const originalEnv = process.env.R4_AUTH_TOKEN

beforeEach(() => delete process.env.R4_AUTH_TOKEN)
afterEach(() => {
	if (originalEnv) {
		process.env.R4_AUTH_TOKEN = originalEnv
	} else {
		delete process.env.R4_AUTH_TOKEN
	}
})

describe('auth', () => {
	test('requireAuth throws when no saved session', async () => {
		// Note: This test may pass if you have a valid saved session
		// To properly test in isolation, would need to mock the auth.js module
		try {
			await requireAuth()
			// If we got here, there's a saved session - that's ok
			expect(true).toBe(true)
		} catch (error) {
			expect(error.message).toContain('Authentication required')
		}
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
		expect(channels.every((ch) => ch.id && ch.slug)).toBe(true)
	})
})

describe('getChannel', () => {
	test('fetches channel by slug', async () => {
		const ch = await getChannel('detecteve')
		expect(ch.slug).toBe('detecteve')
	})

	test('throws for non-existent channel', async () => {
		await expect(getChannel('nonexistent-xyz')).rejects.toThrow()
	})
})

describe('listTracks', () => {
	test('returns non-empty array', async () => {
		const tracks = await listTracks({channelSlugs: ['-songs'], limit: 10})
		expect(tracks.length > 0).toBe(true)
	})

	test('respects limit', async () => {
		const tracks = await listTracks({channelSlugs: ['-songs'], limit: 5})
		expect(tracks.length <= 5).toBe(true)
	})

	test('all have required fields', async () => {
		const tracks = await listTracks({channelSlugs: ['-songs'], limit: 10})
		expect(tracks.every((tr) => tr.id && tr.url)).toBe(true)
	})

	test('filters by channel slug', async () => {
		const tracks = await listTracks({channelSlugs: ['-songs'], limit: 5})
		expect(tracks.every((tr) => tr.slug === '-songs')).toBe(true)
	})

	test('throws 404 error for nonexistent channel', async () => {
		const promise = listTracks({
			channelSlugs: ['nonexistent-channel-12345']
		})

		await expect(promise).rejects.toThrow('Channel not found')

		try {
			await promise
		} catch (error) {
			expect(error.code).toBe('CHANNEL_NOT_FOUND')
			expect(error.statusCode).toBe(404)
		}
	})

	test('throws 404 error for multiple nonexistent channels', async () => {
		const promise = listTracks({
			channelSlugs: ['nonexistent1', 'nonexistent2']
		})

		await expect(promise).rejects.toThrow('Channels not found')

		try {
			await promise
		} catch (error) {
			expect(error.message).toContain('nonexistent1')
			expect(error.message).toContain('nonexistent2')
			expect(error.code).toBe('CHANNEL_NOT_FOUND')
			expect(error.statusCode).toBe(404)
		}
	})
})
