#!/usr/bin/env node
import {route} from './utils.js'

/** Finds the right subcommand, runs it and error handling */
async function main() {
	const argv = process.argv.slice(2)
	try {
		const {commandFile, commandArgv} = await route(argv)
		const {default: cmd} = await import(`file://${commandFile}`)
		if (typeof cmd.run !== 'function')
			throw new Error('Command must export a run() function')
		const result = await cmd.run(commandArgv)
		if (result) console.log(result)
		process.exit(0)
	} catch (error) {
		console.error(error.message)
		process.exit(1)
	}
}

main()
