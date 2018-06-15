#!/usr/bin/env node

const args = require('args')

args
	.command('download', 'Download a radio4000.com channel')
	.command('listen', 'Listen to a radio4000.com channel')
	.example(
		'r4 download 200ok',
		`Download the channel at https://radio4000.com/200ok`
	)
	.example(
		'r4 listen detecteve',
		`Play and listen to the channel at https://radio4000.com/detecteve`
	)

args.parse(process.argv, {
	version: false,
	// Use default terminal color.
	mainColor: ['reset']
})

if (args.sub.length === 0) {
	args.showHelp()
}
