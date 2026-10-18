import assert from 'node:assert/strict'
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises'
import {afterEach, beforeEach, test} from 'node:test'
import {
	classifyFailure,
	filterTracks,
	findBrokenTracks,
	readFailedTrackIds,
	writeBackupJson,
	writeFailures
} from './download.js'

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
				url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
				media_id: 'dQw4w9WgXcQ'
			},
			error: 'Video unavailable'
		}
	]

	const result = await writeFailures(failures, testDir)
	assert.equal(result, `${testDir}/failures.jsonl`)

	const content = await readFile(`${testDir}/failures.jsonl`, 'utf-8')
	const parsed = JSON.parse(content.trim())

	assert.equal(parsed.track.id, 'track1')
	assert.equal(parsed.track.media_id, 'dQw4w9WgXcQ')
	assert.equal(parsed.error, 'Video unavailable')
	assert.ok(parsed.timestamp)
})

test('writeFailures appends to existing file', async () => {
	await writeFailures(
		[
			{
				track: {
					id: 'track1',
					title: 'First',
					url: 'https://youtube.com/watch?v=a'
				},
				error: 'Error 1'
			}
		],
		testDir
	)
	await writeFailures(
		[
			{
				track: {
					id: 'track2',
					title: 'Second',
					url: 'https://youtube.com/watch?v=b'
				},
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
	const failedIds = readFailedTrackIds(testDir, [])
	assert.ok(failedIds instanceof Set)
	assert.equal(failedIds.size, 0)
})

test('readFailedTrackIds reads track IDs from failures.jsonl', async () => {
	const content = [
		{
			timestamp: '2025-01-01T00:00:00Z',
			track: {
				id: 'track1',
				title: 'Song 1',
				url: 'https://youtube.com/watch?v=a'
			},
			error: 'Error'
		},
		{
			timestamp: '2025-01-01T00:00:01Z',
			track: {
				id: 'track2',
				title: 'Song 2',
				url: 'https://youtube.com/watch?v=b'
			},
			error: 'Error'
		}
	]
		.map((obj) => JSON.stringify(obj))
		.join('\n')

	await writeFile(`${testDir}/failures.jsonl`, content, 'utf-8')

	const failedIds = readFailedTrackIds(testDir, [
		{id: 'track1', url: 'https://youtube.com/watch?v=a'},
		{id: 'track2', url: 'https://youtube.com/watch?v=b'}
	])
	assert.equal(failedIds.size, 2)
	assert.ok(failedIds.has('track1'))
	assert.ok(failedIds.has('track2'))
})

test('readFailedTrackIds ignores failures for a URL the track no longer has', async () => {
	const failure = {
		track: {id: 'track1', url: 'https://youtube.com/watch?v=old'},
		error: 'Error'
	}
	await writeFile(`${testDir}/failures.jsonl`, JSON.stringify(failure), 'utf-8')

	const failedIds = readFailedTrackIds(testDir, [
		{id: 'track1', url: 'https://youtube.com/watch?v=new'}
	])
	assert.equal(failedIds.size, 0)
})

const channel = {slug: 'ko002', name: 'KO002'}

const makeTrack = (overrides) => ({
	id: 'abc',
	title: 'Artist - Song',
	url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
	media_id: 'dQw4w9WgXcQ',
	provider: 'youtube',
	...overrides
})

test('writeBackupJson writes ChannelBackup with local paths for existing files', async () => {
	await mkdir(`${testDir}/tracks`, {recursive: true})

	const trackFile = `${testDir}/tracks/Artist - Song [dQw4w9WgXcQ].m4a`
	await writeFile(trackFile, '', 'utf-8')

	const tracks = [
		makeTrack({
			filename: 'Artist - Song [dQw4w9WgXcQ]',
			filepath: trackFile,
			fileExists: true
		})
	]

	await writeBackupJson(channel, tracks, testDir)

	const backup = JSON.parse(await readFile(`${testDir}/download.json`, 'utf-8'))
	assert.equal(backup.version, 2)
	assert.ok(backup.created_at)
	assert.deepEqual(backup.channel, channel)
	assert.equal(
		backup.tracks[0].url,
		'tracks/Artist%20-%20Song%20%5BdQw4w9WgXcQ%5D.m4a'
	)
})

test('writeBackupJson keeps remote URL for tracks that failed (no local file)', async () => {
	const remoteUrl = 'https://youtube.com/watch?v=dQw4w9WgXcQ'
	const tracks = [
		makeTrack({
			filename: 'Artist - Song [dQw4w9WgXcQ]',
			filepath: `${testDir}/tracks/Artist - Song [dQw4w9WgXcQ].m4a`,
			fileExists: false,
			url: remoteUrl
		})
	]

	await writeBackupJson(channel, tracks, testDir)

	const backup = JSON.parse(await readFile(`${testDir}/download.json`, 'utf-8'))
	assert.equal(backup.tracks[0].url, remoteUrl)
})

test('writeBackupJson uses base-url prefix when provided', async () => {
	await mkdir(`${testDir}/tracks`, {recursive: true})

	const trackFile = `${testDir}/tracks/Artist - Song [dQw4w9WgXcQ].m4a`
	await writeFile(trackFile, '', 'utf-8')

	const tracks = [
		makeTrack({
			filename: 'Artist - Song [dQw4w9WgXcQ]',
			filepath: trackFile,
			fileExists: true
		})
	]

	await writeBackupJson(channel, tracks, testDir, {
		baseUrl: 'https://cdn.example.com'
	})

	const backup = JSON.parse(await readFile(`${testDir}/download.json`, 'utf-8'))
	assert.equal(
		backup.tracks[0].url,
		'https://cdn.example.com/tracks/Artist%20-%20Song%20%5BdQw4w9WgXcQ%5D.m4a'
	)
})

test('writeBackupJson strips trailing slash from base-url', async () => {
	await mkdir(`${testDir}/tracks`, {recursive: true})

	const trackFile = `${testDir}/tracks/Artist - Song [dQw4w9WgXcQ].m4a`
	await writeFile(trackFile, '', 'utf-8')

	const tracks = [
		makeTrack({
			filename: 'Artist - Song [dQw4w9WgXcQ]',
			filepath: trackFile,
			fileExists: true
		})
	]

	await writeBackupJson(channel, tracks, testDir, {
		baseUrl: 'https://cdn.example.com/'
	})

	const backup = JSON.parse(await readFile(`${testDir}/download.json`, 'utf-8'))
	assert.equal(
		backup.tracks[0].url,
		'https://cdn.example.com/tracks/Artist%20-%20Song%20%5BdQw4w9WgXcQ%5D.m4a'
	)
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

test('classifyFailure sorts yt-dlp errors by whether the video is gone', () => {
	const cases = [
		['ERROR: [youtube] abc: Video unavailable', 'unavailable'],
		[
			'ERROR: [youtube] abc: Video unavailable. This video is no longer available because the YouTube account associated with this video has been terminated.',
			'unavailable'
		],
		[
			'ERROR: [youtube] abc: Video unavailable. It was removed following a copyright removal request by Someone',
			'unavailable'
		],
		[
			"ERROR: [youtube] abc: This video has been removed for violating YouTube's Terms of Service",
			'unavailable'
		],
		['ERROR: [youtube] abc: Private video', 'private'],
		[
			'ERROR: [youtube] abc: Video unavailable. This video contains content from SME, who has blocked it in your country on copyright grounds',
			'region'
		],
		[
			'ERROR: [youtube] abc: Video unavailable. This content isn’t available, try again later.',
			'transient'
		],
		['ERROR: [youtube] abc: Sign in to confirm you’re not a bot.', 'transient'],
		['ERROR: [youtube] abc: The page needs to be reloaded.', 'transient'],
		['ERROR: unable to download video data: HTTP Error 403', 'transient'],
		[undefined, 'transient']
	]
	for (const [error, reason] of cases) {
		assert.equal(classifyFailure(error), reason, error)
	}
})

test('findBrokenTracks marks only tracks whose latest failure is permanent', () => {
	const url = (id) => `https://www.youtube.com/watch?v=${id}`
	const tracks = [
		{id: 'gone', url: url('a')},
		{id: 'private', url: url('b')},
		{id: 'flaky', url: url('c')},
		{id: 'recovered', url: url('d')},
		{id: 'replaced', url: url('new')},
		{id: 'flagged', url: url('f'), playback_error: 'youtube:150'},
		{id: 'downloaded', url: url('g'), fileExists: true},
		{id: 'never-failed', url: url('h')}
	]
	const fail = (id, trackUrl, error) => ({track: {id, url: trackUrl}, error})
	const failures = [
		fail('gone', url('a'), 'ERROR: Video unavailable'),
		fail('private', url('b'), 'ERROR: Private video'),
		fail('flaky', url('c'), 'ERROR: Sign in to confirm you’re not a bot'),
		fail('recovered', url('d'), 'ERROR: Video unavailable'),
		fail('recovered', url('d'), 'ERROR: The page needs to be reloaded.'),
		fail('replaced', url('old'), 'ERROR: Video unavailable'),
		fail('flagged', url('f'), 'ERROR: Video unavailable'),
		fail('downloaded', url('g'), 'ERROR: Video unavailable')
	]

	const broken = findBrokenTracks(tracks, failures)

	assert.deepEqual(
		broken.map(({track, playback_error}) => [track.id, playback_error]),
		[
			['gone', 'ytdlp:unavailable'],
			['private', 'ytdlp:private']
		]
	)
})

test('filterTracks skips tracks marked broken by --mark-broken, not other playback errors', () => {
	const tracks = [
		{id: 'gone', playback_error: 'ytdlp:unavailable'},
		{id: 'embed-off', playback_error: 'youtube:150'},
		{id: 'fine'}
	]

	const result = filterTracks(tracks, {failedIds: new Set(['gone'])})

	assert.deepEqual(
		result.unavailable.map((t) => t.id),
		['gone']
	)
	assert.equal(result.previouslyFailed.length, 0)
	assert.deepEqual(
		result.toDownload.map((t) => t.id),
		['embed-off', 'fine']
	)
})
