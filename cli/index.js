#!/usr/bin/env node
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {executeCommand} from '../cli-framework/index.js'
import {formatOutput} from '../cli-framework/utils/output.js'

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

		// Determine output format from flags
		const format = result.format || 'json'
		const output = formatOutput(result.data, format, result.formatOptions)

		console.log(output)
		process.exit(0)
	} catch (error) {
		// Handle errors
		console.error('Error:', error.message)
		if (error.context) {
			console.error('Context:', JSON.stringify(error.context, null, 2))
		}
		if (error.type === 'unknown_command' && error.context?.available) {
			console.error('\nAvailable commands:')
			error.context.available.forEach((cmd) => {
				console.error(`  ${cmd}`)
			})
		}
		process.exit(1)
	}
}

main()
