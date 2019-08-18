#!/usr/bin/env node

const args = require('args')
const fs = require('fs-extra')

args
	.option('debug', 'More outputs to the console')
	.option('force', 'Force init with new data')
	.example('r4 deinit', 'De-initialized the current folder as R4 folder1')

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
})

let slug = args.sub[0] || ''

const r4ConfigPath = './r4.json'

const main = async function() {
	const {
		debug: debugOutput
	} = flags
	slug = slug || ''

	if (!fs.existsSync(r4ConfigPath)) {
		debugOutput && console.log('Not a r4 folder')
		return
	}

	debugOutput && console.log('Found r4 folder; existing', r4ConfigPath)

	try {
		fs.unlink(r4ConfigPath)
		debugOutput && console.log('Sucess deinit')
	} catch (error) {
		console.error('Error de-initing r4 folder', r4ConfigPath, error)
	}
}

main()
