#!/usr/bin/env node

const args = require('args')
const {createBackup} = require('radio4000-sdk')
const downloadTracks = require('./lib/download-tracks')
const autocompleteChannels = require('./lib/autocomplete-channels')

args
	.option('destination', 'the path of the folder to download')
	.option('search', 'search for a radio')
	.examples([{
		usage: 'r4 download 200ok',
		description: 'Download a Radio4000 channel with the slug "200ok"'
	}])

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug'
})

let slug = args.sub[0]

const main = async function() {
	if (flags.search) {
		slug = await autocompleteChannels()
	}

	if (!slug) args.showHelp()

	console.log(`Downloading channel: ${slug}…`)

	try {
		const backup = await createBackup(slug)
		const urls = backup.tracks.map(track => `http://www.youtube.com/watch?v=${track.ytid}`)
		await downloadTracks(urls, slug)
		console.log('DONE')
	} catch (err) {
		console.log(err)
	}
}

main()
