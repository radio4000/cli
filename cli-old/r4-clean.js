#!/usr/bin/env node

const args = require('args')
const fs = require('fs-extra')
const path = require('path')

args
	.option('debug', 'More outputs to the console')
	.example(
		'r4 clean a-channel',
		'Download the channel with the slug "a-channel"'
	)

const flags = args.parse(process.argv, {
	version: false,
	value: 'channel-slug',
	mainColor: ['reset']
})

const slug = args.sub[0] || ''

const {debug} = flags

const cleanPath = async (folderPath) => {
	// Remove '' empty string for all files without extension
	const extToClean = ['', '.part', '.ytdl']

	const filesToClean = fs.readdirSync(folderPath).filter((file) => {
		const extname = path.extname(file)
		if (extToClean.includes(extname)) {
			return true
		}
		return false
	})

	if (filesToClean.length) {
		filesToClean.forEach((filePath) => {
			const pathToUnlink = folderPath + filePath
			fs.unlink(pathToUnlink)
			debug && console.log('Cleaned', pathToUnlink)
		})
	} else {
		debug && console.log('0 files to clean')
	}

	debug && console.log(`${filesToClean.length} files cleaned`)
}

const main = async () => {
	const pathToClean = `./${slug}/`
	if (!slug) {
		return
	}

	if (!fs.existsSync(pathToClean)) {
		console.log(pathToClean, 'is not a channel folder')
		return
	}

	debug && console.log('Cleaning channel folder path', pathToClean)

	try {
		await cleanPath(pathToClean)
	} catch (error) {
		console.error('Error cleaning folder path', pathToClean)
	}
}

main()
