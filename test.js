import test from 'ava';
const r4dl = require('./index');
const findTracks = require('./src/find-tracks');
const downloadTracks = require('./src/download-tracks');

test('all functions are there', t => {
	t.is(typeof r4dl, 'function');
	t.is(typeof findTracks, 'function');
	t.is(typeof downloadTracks, 'function');
});

test('findTracks returns an array of strings', async t => {
	const value = await findTracks('http://much.radio4000.com/yas');
	t.ok(value.length);
});
