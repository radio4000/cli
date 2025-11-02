import {describe, expect, test} from 'bun:test'
import {
	channelToSQL,
	channelToText,
	toJSON,
	trackToSQL,
	trackToText
} from './formatters.js'

describe('toJSON', () => {
	test('formats any data as pretty JSON', () => {
		const data = {name: 'test', value: 42}
		expect(toJSON(data)).toBe('{\n  "name": "test",\n  "value": 42\n}')
		expect(toJSON(null)).toBe('null')
		expect(toJSON([1, 2, 3])).toBe('[\n  1,\n  2,\n  3\n]')
	})
})

describe('channelToSQL', () => {
	test('formats single channel as INSERT', () => {
		const channel = {
			id: '1',
			slug: 'test',
			name: 'Test Channel',
			description: 'A test'
		}
		const result = channelToSQL(channel)
		expect(result).toContain('INSERT INTO channels')
		expect(result).toContain('slug')
		expect(result).toContain("'test'")
	})

	test('formats multiple channels as multiple INSERTs', () => {
		const channels = [
			{id: '1', slug: 'ch1', name: 'Channel 1'},
			{id: '2', slug: 'ch2', name: 'Channel 2'}
		]
		const result = channelToSQL(channels)
		const statements = result.split('\n')
		expect(statements).toHaveLength(2)
		expect(result).toContain('ch1')
		expect(result).toContain('ch2')
	})

	test('escapes SQL values correctly', () => {
		const channel = {
			id: '1',
			slug: 'test',
			name: "O'Brien's Channel"
		}
		const result = channelToSQL(channel)
		expect(result).toContain("'O''Brien''s Channel'")
	})
})

describe('trackToSQL', () => {
	test('formats single track as INSERT', () => {
		const track = {
			id: '1',
			title: 'Test Track',
			url: 'https://example.com',
			tags: ['ambient', 'jazz']
		}
		const result = trackToSQL(track)
		expect(result).toContain('INSERT INTO tracks')
		expect(result).toContain('title')
		expect(result).toContain("'Test Track'")
	})

	test('formats array tags as JSON string', () => {
		const track = {
			id: '1',
			title: 'Test',
			url: 'https://example.com',
			tags: ['tag1', 'tag2']
		}
		const result = trackToSQL(track)
		expect(result).toContain('["tag1","tag2"]')
	})

	test('handles multiple tracks', () => {
		const tracks = [
			{id: '1', title: 'Track 1', url: 'http://1.com'},
			{id: '2', title: 'Track 2', url: 'http://2.com'}
		]
		const result = trackToSQL(tracks)
		expect(result.split('\n')).toHaveLength(2)
	})
})

describe('channelToText', () => {
	test('formats single channel as human-readable text', () => {
		const channel = {
			id: '1',
			slug: 'test',
			name: 'Test Channel',
			description: 'A test channel',
			created_at: '2024-01-01T00:00:00Z'
		}
		const result = channelToText(channel)
		expect(result).toContain('Test Channel')
		expect(result).toContain('A test channel')
		expect(result).toContain('Slug: test')
	})

	test('formats multiple channels with separator', () => {
		const channels = [
			{id: '1', slug: 'ch1', name: 'Channel 1', description: 'First'},
			{id: '2', slug: 'ch2', name: 'Channel 2', description: 'Second'}
		]
		const result = channelToText(channels)
		expect(result).toContain('Channel 1')
		expect(result).toContain('Channel 2')
		expect(result).toContain('---') // separator
	})
})

describe('trackToText', () => {
	test('formats single track as title + description + url', () => {
		const track = {
			title: 'Amazing Song',
			description: 'Very nice',
			url: 'https://example.com/track'
		}
		const result = trackToText(track)
		expect(result).toContain('Amazing Song')
		expect(result).toContain('Very nice')
		expect(result).toContain('https://example.com/track')
	})

	test('formats multiple tracks', () => {
		const tracks = [
			{title: 'Song 1', description: 'First', url: 'http://1.com'},
			{title: 'Song 2', description: 'Second', url: 'http://2.com'}
		]
		const result = trackToText(tracks)
		expect(result).toContain('Song 1')
		expect(result).toContain('Song 2')
	})
})
