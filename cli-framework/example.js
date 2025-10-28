#!/usr/bin/env node
/**
 * Example CLI using the framework
 *
 * This demonstrates how to build a CLI using the framework.
 * Run with: node cli-framework/example.js <command>
 */

import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {executeCommand, listCommands} from './index.js'
import {CLIError, ErrorTypes, validateCommandDefinition} from './types.js'
import {
	generateCommandHelp,
	generateGroupHelp,
	generateMainHelp
} from './utils/help.js'
import {formatOutput} from './utils/output.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Main CLI entry point
 */
async function main() {
	const argv = process.argv.slice(2) // Remove 'node' and script path
	const commandsDir = resolve(__dirname, 'test-fixtures', 'commands')

	try {
		// Check for help flag
		if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) {
			// Show help based on context
			if (argv.length <= 1) {
				// Top-level help
				const commands = await listCommands(commandsDir)
				const help = generateMainHelp(commands, 'example', {
					version: '1.0.0',
					description: 'Example CLI built with the framework'
				})
				console.log(help)
				process.exit(0)
			}
			// TODO: Handle command-specific help
		}

		// Execute command
		const result = await executeCommand({
			commandsDir,
			argv,
			context: {
				// Shared context available to all commands
				config: {
					verbose: argv.includes('--verbose')
				}
			}
		})

		// Determine output format
		let format = 'json'
		if (argv.includes('--sql')) format = 'sql'
		if (argv.includes('--text')) format = 'text'

		// Format and output result
		const output = formatOutput(result, format)
		console.log(output)

		process.exit(0)
	} catch (error) {
		handleError(error)
	}
}

/**
 * Error handler with formatted output
 */
function handleError(error) {
	if (error instanceof CLIError) {
		console.error(`Error: ${error.message}`)
		console.error()

		// Provide helpful context based on error type
		switch (error.type) {
			case ErrorTypes.UNKNOWN_COMMAND:
				if (error.context.available && error.context.available.length > 0) {
					console.error('Available commands:')
					for (const cmd of error.context.available) {
						console.error(`  ${cmd.name}`)
					}
				}
				break

			case ErrorTypes.MISSING_ARGUMENT:
				if (error.context.argument) {
					console.error(
						`The '${error.context.argument.name}' argument is required.`
					)
				}
				break

			case ErrorTypes.CONFLICTING_OPTIONS:
				if (error.context.options) {
					console.error(
						`Options --${error.context.options.join(' and --')} cannot be used together.`
					)
				}
				break
		}

		process.exit(1)
	}

	// Generic error
	console.error('Unexpected error:', error.message)
	if (process.env.DEBUG) {
		console.error(error.stack)
	}
	process.exit(1)
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
	main()
}
