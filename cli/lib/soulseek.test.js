import {expect, mock, test} from 'bun:test'
import {createClient, downloadTrack} from './soulseek.js'

// Mock fetch for testing without real slskd
const mockFetch = (responses) => {
	let callIndex = 0
	return mock((_url, _options) => {
		const response = responses[callIndex] || responses[responses.length - 1]
		callIndex++
		return Promise.resolve({
			ok: response.ok !== false,
			status: response.status || 200,
			json: () => Promise.resolve(response.data),
			text: () => Promise.resolve(response.text || '')
		})
	})
}

test('createClient authenticates and returns token', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = mockFetch([{data: {token: 'test-token-123'}}])

	const client = createClient({host: 'localhost', port: 5030})

	// checkConnection calls authenticate internally
	globalThis.fetch = mockFetch([
		{data: {token: 'test-token-123'}},
		{data: {version: '0.24.0'}}
	])

	const connected = await client.checkConnection()
	expect(connected).toBe(true)

	globalThis.fetch = originalFetch
})

test('search returns ranked results filtered by quality', async () => {
	const originalFetch = globalThis.fetch

	const mockResponses = [
		// Auth
		{data: {token: 'test-token'}},
		// Start search
		{data: {id: 'search-123'}},
		// Poll search state (completed)
		{data: {state: 'Completed', isComplete: true}},
		// Get responses
		{
			data: [
				{
					username: 'user1',
					queueLength: 0,
					uploadSpeed: 100000,
					files: [
						{filename: '/music/Artist - Song.flac', size: 30000000, bitRate: 0},
						{filename: '/music/Artist - Song.mp3', size: 8000000, bitRate: 320}
					]
				},
				{
					username: 'user2',
					queueLength: 5,
					uploadSpeed: 50000,
					files: [
						{filename: '/music/Artist - Song.mp3', size: 7000000, bitRate: 256}
					]
				}
			]
		}
	]

	globalThis.fetch = mockFetch(mockResponses)

	const client = createClient({host: 'localhost', port: 5030, username: 'slskd', password: 'slskd'})
	const results = await client.search('Artist Song', {
		timeout: 1000,
		minBitrate: 320
	})

	// Should have 2 results (flac and 320kbps mp3, not the 256kbps)
	expect(results.length).toBe(2)

	// FLAC should be ranked first (lossless)
	expect(results[0].extension).toBe('flac')
	expect(results[0].isLossless).toBe(true)

	// 320kbps mp3 second
	expect(results[1].extension).toBe('mp3')
	expect(results[1].bitrate).toBe(320)

	globalThis.fetch = originalFetch
})

test('buildSearchQuery uses get-artist-title to parse and clean', async () => {
	let capturedQuery = null
	const client = {
		search: mock(async (query) => {
			capturedQuery = query
			return []
		})
	}

	// get-artist-title strips (Official Video) and [Remastered] but keeps (Dub Mix)
	const track = {
		id: 'track-1',
		title: 'Artist - Song (Official Video) [Remastered]'
	}
	await downloadTrack(client, track, '/tmp/test', {})

	expect(capturedQuery).toBe('Artist Song')
})

test('buildSearchQuery strips all parenthetical content for better Soulseek search', async () => {
	let capturedQuery = null
	const client = {
		search: mock(async (query) => {
			capturedQuery = query
			return []
		})
	}

	const track = {id: 'track-2', title: 'Artist - Song (Dub Mix)'}
	await downloadTrack(client, track, '/tmp/test', {})

	// Parenthetical content stripped for search - Soulseek works better with simpler queries
	expect(capturedQuery).toBe('Artist Song')
})

test('downloadTrack returns no_match when no results', async () => {
	const originalFetch = globalThis.fetch

	globalThis.fetch = mockFetch([
		{data: {token: 'test-token'}},
		{data: {id: 'search-123'}},
		{data: {state: 'Completed'}},
		{data: []} // No results
	])

	const client = createClient({host: 'localhost', port: 5030, username: 'slskd', password: 'slskd'})
	const track = {id: 'track-1', title: 'Unknown Artist - Rare Song'}

	const result = await downloadTrack(client, track, '/tmp/test', {})

	expect(result.status).toBe('no_match')
	expect(result.track).toBe(track)

	globalThis.fetch = originalFetch
})

test('quality scoring prefers lossless over high bitrate', () => {
	// This tests the internal scoring logic indirectly through search results ordering
	const originalFetch = globalThis.fetch

	const mockResponses = [
		{data: {token: 'test-token'}},
		{data: {id: 'search-123'}},
		{data: {state: 'Completed'}},
		{
			data: [
				{
					username: 'user1',
					queueLength: 0,
					uploadSpeed: 100000,
					files: [
						// High bitrate MP3
						{filename: '/music/song.mp3', size: 15000000, bitRate: 320}
					]
				},
				{
					username: 'user2',
					queueLength: 0,
					uploadSpeed: 100000,
					files: [
						// FLAC (lossless)
						{filename: '/music/song.flac', size: 30000000, bitRate: 0}
					]
				}
			]
		}
	]

	globalThis.fetch = mockFetch(mockResponses)

	const client = createClient({host: 'localhost', port: 5030, username: 'slskd', password: 'slskd'})

	return client.search('test', {timeout: 100}).then((results) => {
		// FLAC should be first despite being from user2
		expect(results[0].extension).toBe('flac')
		expect(results[0].isLossless).toBe(true)
		expect(results[1].extension).toBe('mp3')

		globalThis.fetch = originalFetch
	})
})

// Note: Title cleaning is handled by get-artist-title library
// It strips (Official Video), [Remastered], etc. but keeps DJ-relevant markers like (Dub Mix)
