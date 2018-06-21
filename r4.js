#!/usr/bin/env node

const args = require('args')

args
	.command(['download', 'dl'], 'Download a channel')
	.command('play', 'Play a channel')
	.example(
		'r4 download 200ok',
		`Download the channel at https://radio4000.com/200ok`
	)
	.example(
		'r4 play detecteve',
		`Play and listen to the channel at https://radio4000.com/detecteve`
	)
	.example('r4 <command> help', `Display help for a specific command`)

args.parse(process.argv, {
	// Use default terminal color.
	mainColor: ['reset']
})

if (args.sub.length === 0) {
	args.showHelp()
}
