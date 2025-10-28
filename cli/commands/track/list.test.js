import {describe, expect, test} from 'bun:test'
import {listTracks} from '../../lib/data.js'

describe('track list', () => {
	test('returns tracks', async () => {
		const tracks = await listTracks({limit: 10})
		expect(tracks.length > 0).toBe(true)
	})

	test('respects limit', async () => {
		const tracks = await listTracks({limit: 5})
		expect(tracks.length <= 5).toBe(true)
	})

	test('filters by channel', async () => {
		const tracks = await listTracks({channelSlugs: ['ko002'], limit: 5})
		expect(tracks.every((tr) => tr.slug === 'ko002')).toBe(true)
	})

	test('tracks have urls', async () => {
		const tracks = await listTracks({limit: 10})
		expect(tracks.every((tr) => new URL(tr.url))).toBe(true)
	})

	test('tracks have titles', async () => {
		const tracks = await listTracks({limit: 10})
		expect(tracks.every((tr) => tr.title?.length > 0)).toBe(true)
	})
})
