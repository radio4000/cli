import assert from 'node:assert/strict'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {afterEach, beforeEach, test} from 'node:test'
import {filterTracks, readFailedTrackIds, writeFailures} from './download.js'

const testDir = '/tmp/r4-test-download'

beforeEach(async () => {
	await rm(testDir, {recursive: true, force: true})
	await mkdir(testDir, {recursive: true})
})

afterEach(async () => {
	await rm(testDir, {recursive: true, force: true})
})

test('writeFailures creates JSONL with correct structure', async () => {
	const failures = [
		{
			track: {
				id: 'track1',
				title: 'Artist - Song 1',
				url: 'https://youtube.com/watch?v=abc123'
			},
			error: 'Video unavailable'
		}
	]

	const result = await writeFailures(failures, testDir)
	assert.equal(result, `${testDir}/failures.jsonl`)

	const content = await readFile(`${testDir}/failures.jsonl`, 'utf-8')
	const parsed = JSON.parse(content.trim())

	assert.equal(parsed.track.id, 'track1')
	assert.equal(parsed.track.youtubeId, 'abc123')
	assert.equal(parsed.error, 'Video unavailable')
	assert.ok(parsed.timestamp)
})

test('writeFailures appends to existing file', async () => {
	await writeFailures(
		[
			{
				track: {id: 'track1', title: 'First', url: 'https://youtube.com/watch?v=a'},
				error: 'Error 1'
			}
		],
		testDir
	)
	await writeFailures(
		[
			{
				track: {id: 'track2', title: 'Second', url: 'https://youtube.com/watch?v=b'},
				error: 'Error 2'
			}
		],
		testDir
	)

	const content = await readFile(`${testDir}/failures.jsonl`, 'utf-8')
	const lines = content.trim().split('\n')

	assert.equal(lines.length, 2)
	assert.equal(JSON.parse(lines[0]).track.id, 'track1')
	assert.equal(JSON.parse(lines[1]).track.id, 'track2')
})

test('writeFailures returns null for empty array', async () => {
	const result = await writeFailures([], testDir)
	assert.equal(result, null)
})

test('readFailedTrackIds returns empty Set when no file exists', async () => {
	const failedIds = readFailedTrackIds(testDir)
	assert.ok(failedIds instanceof Set)
	assert.equal(failedIds.size, 0)
})

test('readFailedTrackIds reads track IDs from failures.jsonl', async () => {
	const content = [
		{
			timestamp: '2025-01-01T00:00:00Z',
			track: {id: 'track1', title: 'Song 1', url: 'https://youtube.com/watch?v=a'},
			error: 'Error'
		},
		{
			timestamp: '2025-01-01T00:00:01Z',
			track: {id: 'track2', title: 'Song 2', url: 'https://youtube.com/watch?v=b'},
			error: 'Error'
		}
	]
		.map((obj) => JSON.stringify(obj))
		.join('\n')

	await writeFile(`${testDir}/failures.jsonl`, content, 'utf-8')

	const failedIds = readFailedTrackIds(testDir)
	assert.equal(failedIds.size, 2)
	assert.ok(failedIds.has('track1'))
	assert.ok(failedIds.has('track2'))
})

test('filterTracks excludes previously failed tracks by default', async () => {
	const tracks = [
		{id: 'track1', title: 'Song 1', url: 'http://example.com/1'},
		{id: 'track2', title: 'Song 2', url: 'http://example.com/2'},
		{id: 'track3', title: 'Song 3', url: 'http://example.com/3'},
		{id: 'track4', title: 'Song 4', url: 'http://example.com/4'}
	]

	const failedIds = new Set(['track2', 'track4'])

	const result = filterTracks(tracks, {failedIds})

	assert.equal(result.previouslyFailed.length, 2)
	assert.equal(result.toDownload.length, 2)
	assert.ok(result.toDownload.some((t) => t.id === 'track1'))
	assert.ok(result.toDownload.some((t) => t.id === 'track3'))
	assert.ok(!result.toDownload.some((t) => t.id === 'track2'))
	assert.ok(!result.toDownload.some((t) => t.id === 'track4'))
})

test('filterTracks includes failed tracks when force=true', async () => {
	const tracks = [
		{id: 'track1', title: 'Song 1', url: 'http://example.com/1'},
		{id: 'track2', title: 'Song 2', url: 'http://example.com/2'}
	]

	const failedIds = new Set(['track2'])

	const result = filterTracks(tracks, {failedIds, force: true})

	// When force=true, all tracks should be in toDownload
	assert.equal(result.toDownload.length, 2)
	assert.ok(result.toDownload.some((t) => t.id === 'track1'))
	assert.ok(result.toDownload.some((t) => t.id === 'track2'))
})
