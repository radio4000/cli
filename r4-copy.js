#!/usr/bin/env node

const args = require('args')
const path = require('path')
const spawn = require('child_process').spawn
const commandExists = require('command-exists')

args
	.option('debug', 'Show debug messages')
	.example('r4 copy a-channel /a-path', 'Copy channel "a-channel" to destination path /a-path')

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
})

let slug = args.sub[0]
let destinationPath = args.sub[1]

if (!slug || !destinationPath) return args.showHelp()

// make sure the slug is a local folder
slug = path.basename(slug)
destinationPath = path.normalize(destinationPath)

const main = async () => {
	const {
		debug: showDebug
	} = flags

	try {
		await commandExists('rsync')
	} catch {
		console.error('You need to install rsync')
		return
	}

	const rsyncOptions = [
		'--recursive',
		'--ignore-existing',
		'--progress',
		'--human-readable',
		'-zz', // compress
		`./${slug}`,
		destinationPath
	]

	const sync = new Promise((resolve, reject) => {
		showDebug && console.log(`Starting copying for channel: ${slug}`)
		const cmd = spawn('rsync', rsyncOptions)
		cmd.stdout.on('data', data => {
			showDebug && console.log(`${data}`)
		})

		cmd.stderr.on('data', data => {
			showDebug && console.error(`${data}`)
			reject(data)
		})

		cmd.on('close', () => {
			resolve(cmd)
		})
	})

	try {
		await sync
	} catch(error) {
		console.error('Error copying files:', error.toString('utf-8'))
		return
	}
	showDebug && console.log(`Success syncing ./${slug} to ${destinationPath}`)
	return 0
}

main()
