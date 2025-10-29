import assert from 'node:assert/strict'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {test} from 'node:test'
import {filterTracks, readFailedTrackIds, writeFailures} from './download.js'

test('writeFailures creates JSONL file with failures', async () => {
	const testDir = '/tmp/r4-test-download'
	await rm(testDir, {recursive: true, force: true})
	await mkdir(testDir, {recursive: true})

	const failures = [
		{
			track: {
				id: 'track1',
				title: 'Artist - Song 1',
				url: 'https://youtube.com/watch?v=abc123'
			},
			error: 'Video unavailable'
		},
		{
			track: {
				id: 'track2',
				title: 'Artist - Song 2',
				url: 'https://youtube.com/watch?v=def456'
			},
			error: 'Private video'
		}
	]

	const result = await writeFailures(failures, testDir)

	assert.equal(result, `${testDir}/failures.jsonl`)

	// Read and verify JSONL content
	const content = await readFile(`${testDir}/failures.jsonl`, 'utf-8')
	const lines = content.trim().split('\n')

	assert.equal(lines.length, 2)

	const first = JSON.parse(lines[0])
	assert.equal(first.track.id, 'track1')
	assert.equal(first.track.title, 'Artist - Song 1')
	assert.equal(first.track.youtubeId, 'abc123')
	assert.equal(first.error, 'Video unavailable')
	assert.ok(first.timestamp)

	const second = JSON.parse(lines[1])
	assert.equal(second.track.id, 'track2')
	assert.equal(second.error, 'Private video')

	// Cleanup
	await rm(testDir, {recursive: true, force: true})
})

test('writeFailures appends to existing file', async () => {
	const testDir = '/tmp/r4-test-download-append'
	await rm(testDir, {recursive: true, force: true})
	await mkdir(testDir, {recursive: true})

	const failures1 = [
		{
			track: {
				id: 'track1',
				title: 'First batch',
				url: 'https://youtube.com/watch?v=abc'
			},
			error: 'Error 1'
		}
	]

	const failures2 = [
		{
			track: {
				id: 'track2',
				title: 'Second batch',
				url: 'https://youtube.com/watch?v=def'
			},
			error: 'Error 2'
		}
	]

	await writeFailures(failures1, testDir)
	await writeFailures(failures2, testDir)

	const content = await readFile(`${testDir}/failures.jsonl`, 'utf-8')
	const lines = content.trim().split('\n')

	assert.equal(lines.length, 2)
	assert.equal(JSON.parse(lines[0]).track.title, 'First batch')
	assert.equal(JSON.parse(lines[1]).track.title, 'Second batch')

	// Cleanup
	await rm(testDir, {recursive: true, force: true})
})

test('writeFailures returns null for empty failures', async () => {
	const testDir = '/tmp/r4-test-download-empty'
	await rm(testDir, {recursive: true, force: true})
	await mkdir(testDir, {recursive: true})

	const result = await writeFailures([], testDir)

	assert.equal(result, null)

	// Cleanup
	await rm(testDir, {recursive: true, force: true})
})

test('readFailedTrackIds returns empty Set when no failures.jsonl exists', async () => {
	const testDir = '/tmp/r4-test-read-failures-none'
	await rm(testDir, {recursive: true, force: true})
	await mkdir(testDir, {recursive: true})

	const failedIds = readFailedTrackIds(testDir)

	assert.ok(failedIds instanceof Set)
	assert.equal(failedIds.size, 0)

	// Cleanup
	await rm(testDir, {recursive: true, force: true})
})

test('readFailedTrackIds reads track IDs from failures.jsonl', async () => {
	const testDir = '/tmp/r4-test-read-failures'
	await rm(testDir, {recursive: true, force: true})
	await mkdir(testDir, {recursive: true})

	// Create failures.jsonl with some failures
	const content = [
		JSON.stringify({
			timestamp: '2025-01-01T00:00:00Z',
			track: {
				id: 'track1',
				title: 'Song 1',
				url: 'https://youtube.com/watch?v=abc'
			},
			error: 'Video unavailable'
		}),
		JSON.stringify({
			timestamp: '2025-01-01T00:00:01Z',
			track: {
				id: 'track2',
				title: 'Song 2',
				url: 'https://youtube.com/watch?v=def'
			},
			error: 'Private video'
		}),
		JSON.stringify({
			timestamp: '2025-01-01T00:00:02Z',
			track: {
				id: 'track3',
				title: 'Song 3',
				url: 'https://youtube.com/watch?v=ghi'
			},
			error: 'Removed'
		})
	].join('\n')

	await writeFile(`${testDir}/failures.jsonl`, content, 'utf-8')

	const failedIds = readFailedTrackIds(testDir)

	assert.ok(failedIds instanceof Set)
	assert.equal(failedIds.size, 3)
	assert.ok(failedIds.has('track1'))
	assert.ok(failedIds.has('track2'))
	assert.ok(failedIds.has('track3'))

	// Cleanup
	await rm(testDir, {recursive: true, force: true})
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
