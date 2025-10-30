#!/usr/bin/env node
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {executeCommand} from '../cli-framework/index.js'
import {formatCLIError} from '../cli-framework/utils/help.js'
import {formatOutput} from './lib/formatters.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
	const argv = process.argv.slice(2)

	try {
		const result = await executeCommand({
			commandsDir: resolve(__dirname, 'commands'),
			argv,
			context: {
				cwd: process.cwd()
			}
		})

		// Commands can return either a string or a structured result with format
		if (result) {
			if (typeof result === 'string') {
				console.log(result)
			} else if (result && typeof result === 'object' && 'format' in result) {
				// Structured result with format - use formatter
				const output = formatOutput(
					result.data,
					result.format,
					result.formatOptions
				)
				console.log(output)
			} else {
				// Plain object/value - output as-is
				console.log(result)
			}
		}
		process.exit(0)
	} catch (error) {
		// Handle errors - use framework's error formatter
		const output = formatCLIError(error)

		// Print to stdout for help and menu-like messages, stderr for actual errors
		if (
			error.type === 'help_requested' ||
			(error.type === 'unknown_command' && error.context?.available)
		) {
			console.log(output)
			process.exit(0) // Help is not an error
		} else {
			console.error(output)
			process.exit(1)
		}
	}
}

main()
