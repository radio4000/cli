#!/usr/bin/env node
import {route} from './utils.js'

/** Finds the right subcommand, runs it and error handling */
async function main() {
	const argv = process.argv.slice(2)
	try {
		const {commandFile, commandArgv, commandName} = await route(argv)
		const {default: cmd} = await import(`file://${commandFile}`)
		if (typeof cmd.run !== 'function')
			throw new Error('Command must export a run() function')

		// Handle --help / -h flags
		if (commandArgv.includes('--help') || commandArgv.includes('-h')) {
			const help = formatCommandHelp(commandName, cmd)
			console.log(help)
			process.exit(0)
		}

		const result = await cmd.run(commandArgv)
		if (result) {
			// Write result and ensure stdout is flushed before exit
			// This prevents truncation when output exceeds buffer size (e.g., large JSON)
			process.stdout.write(result)
			process.stdout.write('\n', () => {
				process.exit(0)
			})
		} else {
			process.exit(0)
		}
	} catch (error) {
		console.error(error.message)
		process.exit(1)
	}
}

/** Format help text for a specific command */
function formatCommandHelp(commandName, cmd) {
	const lines = []
	lines.push(`Usage: r4 ${commandName} [options]`)
	lines.push('')
	if (cmd.description) {
		lines.push(cmd.description)
		lines.push('')
	}
	if (cmd.examples && cmd.examples.length > 0) {
		lines.push('Examples:')
		for (const example of cmd.examples) {
			lines.push(`  ${example}`)
		}
	}
	return lines.join('\n')
}

main()
