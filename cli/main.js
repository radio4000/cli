#!/usr/bin/env node
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {route} from './utils.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
	const argv = process.argv.slice(2)
	const commandsDir = resolve(__dirname, 'commands')

	try {
		// Route to command file
		const {commandFile, commandArgv} = await route(commandsDir, argv)

		// Load command
		const {default: cmd} = await import(`file://${commandFile}`)

		// Execute command
		if (typeof cmd.run !== 'function') {
			throw new Error('Command must export a run() function')
		}

		const result = await cmd.run(commandArgv)

		// Commands return formatted strings, just print
		if (result) {
			console.log(result)
		}
		process.exit(0)
	} catch (error) {
		// Simple error handling - just print the error message
		console.error(error.message)
		process.exit(1)
	}
}

main()
