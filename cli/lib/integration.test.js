import {describe, expect, test} from 'bun:test'
import {getChannel, listChannels, listTracks} from './data.js'
import {channelSchema, trackSchema} from './schema.js'

const validateWith = (schema) => (item) => {
	try {
		schema.parse(item)
		return true
	} catch {
		return false
	}
}

describe('v1/v2 compatibility', () => {
	test('channels pass same schema', async () => {
		const channels = await listChannels({limit: 50})
		expect(channels.every(validateWith(channelSchema))).toBe(true)
	})

	test('tracks pass same schema', async () => {
		const tracks = await listTracks({limit: 100})
		expect(tracks.every(validateWith(trackSchema))).toBe(true)
	})

	test('v1 and v2 channels coexist', async () => {
		const v1 = await getChannel('detecteve')
		const v2 = await getChannel('ko002')
		expect(v1.source).toBe('v1')
		expect(v2.source).toBe('v2')
	})
})

describe('data consistency', () => {
	test('track slugs match channel filter', async () => {
		const tracks = await listTracks({channelSlugs: ['ko002'], limit: 10})
		expect(tracks.every((tr) => tr.slug === 'ko002')).toBe(true)
	})

	test('all track urls are valid', async () => {
		const tracks = await listTracks({limit: 50})
		expect(tracks.every((tr) => new URL(tr.url))).toBe(true)
	})

	test('channel slugs are non-empty', async () => {
		const channels = await listChannels({limit: 50})
		expect(channels.every((ch) => ch.slug?.length > 0)).toBe(true)
	})

	test('track titles are non-empty', async () => {
		const tracks = await listTracks({limit: 50})
		expect(tracks.every((tr) => tr.title?.length > 0)).toBe(true)
	})
})

describe('error handling', () => {
	test('getChannel throws for invalid slug', async () => {
		await expect(getChannel('nonexistent-xyz')).rejects.toThrow(
			'Channel not found'
		)
	})
})
