#!/usr/bin/env node

const args = require('args')
const fs = require('fs-extra')
const os = require('os')

args
	.option('debug', 'More outputs to the console')
	.option('force', 'Force init with new data')
	.example('r4 init a-channel', 'Init the channel "a-channel", as your r4 channel, at path "./r4.json"')

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
})

let slug = args.sub[0] || ''

const {
	debug: debugOutput,
	force: forceInit
} = flags

const r4ConfigPath = './r4.json'

const main = async function() {
	slug = slug || ''

	if (fs.existsSync(r4ConfigPath)) {
		if (forceInit) {
			debugOutput && console.log('Forcing reinit')
		} else {
			console.log('This folder is already R4 folder; see', r4ConfigPath)
			return
		}
	}

	const channelData = {
		channel: slug
	}

	try {
		fs.writeFile(r4ConfigPath, JSON.stringify(channelData) + os.EOL)
		debugOutput && console.log('Created', r4ConfigPath)
	} catch (error) {
		console.error('Error creating file', r4ConfigPath, error)
	}
}

main()
