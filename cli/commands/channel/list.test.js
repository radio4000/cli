import {describe, expect, test} from 'bun:test'
import {listChannels} from '../../lib/data.js'

describe('channel list', () => {
	test('returns channels', async () => {
		const channels = await listChannels({limit: 10})
		expect(channels.length > 0).toBe(true)
	})

	test('respects limit', async () => {
		const channels = await listChannels({limit: 5})
		expect(channels.length <= 5).toBe(true)
	})

	test('channels have slugs', async () => {
		const channels = await listChannels({limit: 10})
		expect(channels.every((ch) => ch.slug?.length > 0)).toBe(true)
	})

	test('channels have names', async () => {
		const channels = await listChannels({limit: 10})
		expect(channels.every((ch) => ch.name?.length > 0)).toBe(true)
	})

	test('slugs are unique', async () => {
		const channels = await listChannels({limit: 50})
		const slugs = channels.map((ch) => ch.slug)
		expect(slugs.length === new Set(slugs).size).toBe(true)
	})
})
