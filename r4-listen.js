#!/usr/bin/env node

const args = require('args')
const listenToYoutube = require('listen-to-youtube-cli')
const Speaker = require('speaker')
const {findChannelBySlug, findTracksByChannel} = require('radio4000-sdk')
const autocompleteChannels = require('./lib/autocomplete-channels')

args
	.option('search', 'search for a radio')
	.example('r4 listen 200ok', 'Listen to the channel with slug "200ok"')

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

	// Get a track
	const channel = await findChannelBySlug(slug)
	const tracks = await findTracksByChannel(channel.id)
	const url = tracks[0].ytid
	console.log(
		`Listening to ${tracks[0].title} from ${
			channel.title
		}. Playback will stop after one track…`
	)
	await listenToYoutube(url, new Speaker())
	console.log('we are done')
	process.exit()
}

main()
