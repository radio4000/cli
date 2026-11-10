import {expect, test} from 'bun:test'
import {extractTags, filterTracksByTags, getUniqueTags} from './tags.js'

test('extractTags: extracts hashtags from text', () => {
	expect(extractTags('#ambient #drone test')).toEqual(['ambient', 'drone'])
	expect(extractTags('hello #world')).toEqual(['world'])
	expect(extractTags('no tags here')).toEqual([])
	expect(extractTags('')).toEqual([])
	expect(extractTags(null)).toEqual([])
})

test('extractTags: handles various formats', () => {
	expect(extractTags('#House #techno-minimal #90s')).toEqual([
		'90s',
		'house',
		'techno-minimal'
	])
	expect(extractTags('#test_tag')).toEqual(['test_tag'])
})

test('extractTags: same rule as the database', () => {
	expect(extractTags('#Techno, (#uk) page#top #weird#minimal')).toEqual([
		'techno',
		'uk',
		'weird'
	])
})

test('getUniqueTags: returns empty for empty array', () => {
	const result = getUniqueTags([])
	expect(result.tags).toEqual([])
	expect(result.sortedTags).toEqual([])
	expect(result.tagMap.size).toBe(0)
})

test('getUniqueTags: extracts unique tags from tracks with tags array', () => {
	const tracks = [
		{tags: ['ambient', 'drone']},
		{tags: ['ambient', 'house']},
		{tags: ['techno']}
	]

	const result = getUniqueTags(tracks)

	expect(result.tags).toEqual(['ambient', 'drone', 'house', 'techno'])
	expect(result.tagMap.get('ambient')).toBe(2)
	expect(result.tagMap.get('drone')).toBe(1)
	expect(result.tagMap.get('house')).toBe(1)
	expect(result.tagMap.get('techno')).toBe(1)
})

test('getUniqueTags: falls back to extracting from description', () => {
	const tracks = [
		{description: '#ambient #drone'},
		{description: '#ambient #house'}
	]

	const result = getUniqueTags(tracks)

	expect(result.tags).toEqual(['ambient', 'drone', 'house'])
	expect(result.tagMap.get('ambient')).toBe(2)
})

test('getUniqueTags: sortedTags are ordered by count desc', () => {
	const tracks = [
		{tags: ['a']},
		{tags: ['b']},
		{tags: ['b']},
		{tags: ['c']},
		{tags: ['c']},
		{tags: ['c']}
	]

	const result = getUniqueTags(tracks)

	expect(result.sortedTags).toEqual([
		['c', 3],
		['b', 2],
		['a', 1]
	])
})

test('filterTracksByTags: filters tracks with any matching tag', () => {
	const tracks = [
		{tags: ['ambient', 'drone']},
		{tags: ['house', 'techno']},
		{tags: ['ambient']}
	]

	const result = filterTracksByTags(tracks, ['ambient'])

	expect(result.length).toBe(2)
	expect(result[0].tags).toContain('ambient')
	expect(result[1].tags).toContain('ambient')
})

test('filterTracksByTags: matchAll requires all tags', () => {
	const tracks = [
		{tags: ['ambient', 'drone']},
		{tags: ['ambient']},
		{tags: ['drone']}
	]

	const result = filterTracksByTags(tracks, ['ambient', 'drone'], true)

	expect(result.length).toBe(1)
	expect(result[0].tags).toEqual(['ambient', 'drone'])
})

test('filterTracksByTags: works with description fallback', () => {
	const tracks = [{description: '#ambient #drone'}, {description: '#house'}]

	const result = filterTracksByTags(tracks, ['ambient'])

	expect(result.length).toBe(1)
})

test('filterTracksByTags: is case insensitive', () => {
	const tracks = [{tags: ['Ambient', 'DRONE']}]

	const result = filterTracksByTags(tracks, ['ambient'])

	expect(result.length).toBe(1)
})
