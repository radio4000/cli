#!/usr/bin/env node

const args = require('args')

args
	.command(['download', 'dl'], 'Download a channel')
	.command(['init'], 'Init the current folder as r4 folder, with a default channel')
	.command(['deinit'], 'De-init the current folder as r4 folder')
	.command(['clean'], 'Clean a channel folder')
	.example(
		'r4 download a-channel',
		`Download the channel at https://radio4000.com/a-channel`
	)
	.example('r4 init a-channel', `Init the current folder as a Radio4000 folder with the channel "a-channel" as default`)
	.example('r4 clean a-channel', `Clean all unecessary files in the ./a-channel channel folder`)
	.example('r4 <command> help', `Display help for a specific command`)

args.parse(process.argv, {
	// Use default terminal color.
	mainColor: ['reset']
})

if (args.sub.length === 0) {
	args.showHelp()
}
