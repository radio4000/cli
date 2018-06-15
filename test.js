import test from 'ava'
import downloadTracks from './lib/download-tracks'

test('all functions are there', t => {
	t.is(typeof downloadTracks, 'function')
})

// @todo test downloadTracks
