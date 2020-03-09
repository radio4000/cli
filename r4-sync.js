#!/usr/bin/env node
const args = require('args')
const path = require('path')
const fs = require('fs-extra')

const {} = require('./r4-download')

args
	.example('r4 sync', 'Sync channel defined at "./r4.json". You should run it in the home r4 folder, when you ran init')
	.example('r4 sync a-channel', 'Syncs data for channel "a-channel" to destination path "./a-chanel"')

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
})

let slug = args.sub[0] || ''
slug = path.basename(slug)

const main = async function() {
	let defaultChannel
	if (!slug || !destinationPath) {
		try {
			const defaultData = await fs.readJson('./r4.json')
			defaultChannel = defaultData.channel
		} catch(error) {
			if (error.errno === -2) {
				console.warn('No file found at "./r4.json"; try to run: r4 init')
			} else {
				console.error(error)
			}
		}
	}
}

main()
