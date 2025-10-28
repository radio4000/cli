import {describe, expect, test} from 'bun:test'
import {getChannel} from '../../lib/data.js'
import {channelSchema} from '../../lib/schema.js'

describe('channel view command - v1 and v2 compatibility', () => {
	test('fetches v1 channel (detecteve)', async () => {
		const channel = await getChannel('detecteve')

		// Validate with schema
		expect(() => channelSchema.parse(channel)).not.toThrow()

		// Verify specific v1 channel properties
		expect(channel.slug).toBe('detecteve')
		expect(channel.name).toBe('detecteve')
		expect(channel.source).toBe('v1')
		expect(channel.id).toBe('bd7f8331-df10-59c6-bc13-c7f782a885eb')
		expect(channel.description).toBe('alone stone radio')
		expect(channel.track_count).toBe(864)
	})

	test('fetches v2 channel (ko002)', async () => {
		const channel = await getChannel('ko002')

		// Validate with schema
		expect(() => channelSchema.parse(channel)).not.toThrow()

		// Verify specific v2 channel properties
		expect(channel.slug).toBe('ko002')
		expect(channel.source).toBe('v2')
		expect(channel.id).toBeDefined()
		expect(channel.name).toContain('ko002')
	})

	test('fetches v2 channel (oskar)', async () => {
		const channel = await getChannel('oskar')

		// Validate with schema
		expect(() => channelSchema.parse(channel)).not.toThrow()

		// Verify specific v2 channel properties
		expect(channel.slug).toBe('oskar')
		expect(channel.source).toBe('v2')
		expect(channel.id).toBeDefined()
		expect(channel.name).toBe('Radio Oskar')
	})

	test('fetches multiple channels (mixed v1 and v2)', async () => {
		const slugs = ['detecteve', 'ko002', 'oskar']
		const channels = await Promise.all(slugs.map((slug) => getChannel(slug)))

		expect(channels).toHaveLength(3)

		// Validate all channels with schema
		channels.forEach((channel) => {
			expect(() => channelSchema.parse(channel)).not.toThrow()
		})

		// Verify v1 channel
		const detecteve = channels.find((ch) => ch.slug === 'detecteve')
		expect(detecteve).toBeDefined()
		expect(detecteve.source).toBe('v1')

		// Verify v2 channels
		const ko002 = channels.find((ch) => ch.slug === 'ko002')
		expect(ko002).toBeDefined()
		expect(ko002.source).toBe('v2')

		const oskar = channels.find((ch) => ch.slug === 'oskar')
		expect(oskar).toBeDefined()
		expect(oskar.source).toBe('v2')
	})

	test('throws error for non-existent channel', async () => {
		expect(async () => {
			await getChannel('non-existent-channel-12345')
		}).toThrow('Channel not found: non-existent-channel-12345')
	})
})

describe('channel view command - format options', () => {
	test('formats output as JSON (default)', async () => {
		const command = await import('./view.js')
		const result = await command.default.handler({slug: 'ko002'})

		expect(result.format).toBe('json')
		expect(result.data).toBeDefined()
		expect(result.data.slug).toBe('ko002')
	})

	test('formats output as SQL', async () => {
		const command = await import('./view.js')
		const result = await command.default.handler({slug: 'ko002', format: 'sql'})

		expect(result.format).toBe('sql')
		expect(result.formatOptions).toEqual({table: 'channels'})
		expect(result.data.slug).toBe('ko002')
	})

	test('formats output as text', async () => {
		const command = await import('./view.js')
		const result = await command.default.handler({slug: 'ko002', format: 'text'})

		expect(result.format).toBe('text')
		expect(result.data.slug).toBe('ko002')
	})
})
