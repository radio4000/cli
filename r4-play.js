#!/usr/bin/env node

const args = require('args')
const listenToYoutube = require('listen-to-youtube-cli')
const Speaker = require('speaker')
const {findChannelBySlug, findTracksByChannel} = require('radio4000-sdk')
const autocompleteChannels = require('./lib/autocomplete-channels')

args
	.option('search', 'Enable search mode')
	.example('r4 play 200ok', 'Play the channel with the URL "200ok"')
	.example('r4 play --search', 'Search for the radio to play')

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
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
	console.log(`Listening to ${tracks[0].title} from ${channel.title}.`)
	await listenToYoutube(url, new Speaker())
	console.log(
		`Continue listening at https://radio4000.com/${channel.slug}/play`
	)
	process.exit()
}

main()
