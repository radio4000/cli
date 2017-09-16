import test from 'ava'
const findTracks = require('./src/find-tracks')
const downloadTracks = require('./src/download-tracks')
const r4dl = require('./index')

test('all functions are there', t => {
	t.plan(3)
	t.is(typeof r4dl, 'function')
	t.is(typeof findTracks, 'function')
	t.is(typeof downloadTracks, 'function')
})

test('can get all youtube ids from a channel', async t => {
	t.plan(2)
	const testUrl = 'https://radio4000.com/the-blueprint'
	const tracks = await findTracks(testUrl)
	t.truthy(tracks.length)
	t.true(typeof tracks[1] === 'string')
})

// @todo test downloadTracks
