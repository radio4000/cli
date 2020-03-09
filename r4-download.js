#!/usr/bin/env node

const args = require('args')
const fs = require('fs-extra')
const {createBackup} = require('radio4000-sdk')
const commandExists = require('command-exists')
const downloadTracks = require('./lib/download-tracks')
const autocompleteChannels = require('./lib/autocomplete-channels')

args
	.option('search', 'Enable search mode')
	.option('forceMedia', 'Force redownload of all media, even those marked as mediaNotavailable on a r4 track')
	.option('force', 'Force redownload and overwrite of all media for this channel')
	.option('debug', 'Output to the console more information to help debug this software')
	.example('r4 download 200ok', 'Download the channel with the slug "200ok". Overwriting existing data')
	.example('r4 download --search', 'Search for a radio to download')

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
})

let slug = args.sub[0]

// If the "dl" alias is used, slug is second argument.
if (slug === 'dl') slug = args.sub[1]

const saveChannelData = async (channelData, backupPath) => {
	return fs.outputFile(backupPath, JSON.stringify(channelData))
}

const main = async function() {
	// Get command line flags
	const {
		debug: debugOutput,
		search: showSearch,
		force: forceDownload,
		forceMedia: forceMediaAvailableCheck,
	} = flags

	try {
		await commandExists('youtube-dl')
	} catch (error) {
		console.warn(
			'You need to install youtube-dl. See https://rg3.github.io/youtube-dl/'
		)
		return
	}

	try {
		await commandExists('ffmpeg')
	} catch (error) {
		console.warn(
			'You need to install ffmpeg. See https://ffmpeg.org/download.html'
		)
		return
	}

	try {
		await require('dns').lookup('1.1.1.1', error => {
			if (error && error.code == "ENOTFOUND") {
        return error
      }
			return true
		})
	} catch (error) {
		console.warn('Error: there is no internet connection. It is required for this command')
		return
	}

	if (showSearch) {
		slug = await autocompleteChannels()
	}

	if (!slug) args.showHelp()

	console.log(`Starting download for channel: ${slug}`)

	// first get the backup
	let backup
	try {
		debugOutput && console.log('Fetching data @ api.radio4000.com')
		backup = await createBackup(slug)
	} catch (error) {
		console.warn(error)
		return
	}

	// Save the channel.backup json information to a file
	try {
		const backupPath = `./${slug}/${slug}.json`
		await saveChannelData(backup, backupPath)
		console.log(`Saved channel information as text: ${backupPath}`)
	} catch (error) {
		console.warn(error)
	}

	// Save the channels media to files
	const downloadOptions = {
		forceMediaAvailableCheck,
		forceDownload,
		debugOutput
	}
	try {
		await downloadTracks(backup.tracks, slug, downloadOptions)
		console.log(`Finished download for channel: ${slug}`)
	} catch (error) {
		console.warn(error)
	}

}

main()
