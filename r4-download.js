#!/usr/bin/env node

const args = require('args')
const {createBackup} = require('radio4000-sdk')
const commandExists = require('command-exists')
const downloadTracks = require('./lib/download-tracks')
const autocompleteChannels = require('./lib/autocomplete-channels')

args
	.option('search', 'Enable search mode')
	.example('r4 download 200ok', 'Download the channel with the slug "200ok"')
	.example('r4 download --search', 'Search for a radio to download')

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
})

let slug = args.sub[0]

// If the "dl" alias is used, slug is second argument.
if (slug === 'dl') slug = args.sub[1]

const main = async function() {
	try {
		await commandExists('youtube-dl')
	} catch (err) {
		console.warn(
			'You need to install youtube-dl. See https://rg3.github.io/youtube-dl/'
		)
		return
	}

	if (flags.search) {
		slug = await autocompleteChannels()
	}

	if (!slug) args.showHelp()

	console.log(`Downloading channel: ${slug}…`)

	try {
		const backup = await createBackup(slug)
		const urls = backup.tracks.map(
			track => `http://www.youtube.com/watch?v=${track.ytid}`
		)
		await downloadTracks(urls, slug)
		console.log('DONE')
	} catch (err) {
		console.warn(err)
	}
}

main()
