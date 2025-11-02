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

		if (handleHelpFlags(commandArgv, commandName, cmd)) return

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

function handleHelpFlags(argv, commandName, cmd) {
	if (argv.includes('--help') || argv.includes('-h')) {
		console.log(formatCommandHelp(commandName, cmd))
		process.exit(0)
		return true
	}
	return false
}

function formatCommandHelp(commandName, cmd) {
	const lines = []
	lines.push(`Usage: r4 ${commandName} [options]`, '')
	if (cmd.description) lines.push(cmd.description, '')
	if (cmd.options) lines.push(...formatOptions(cmd.options), '')
	if (cmd.examples) lines.push(...formatExamples(cmd.examples))
	return lines.join('\n')
}

function formatOptions(options) {
	if (!options || Object.keys(options).length === 0) return []
	const lines = ['Options:']
	for (const [name, def] of Object.entries(options)) {
		const flag = formatFlag(name, def)
		const desc = formatDescription(def)
		const padding = ' '.repeat(Math.max(1, 20 - flag.length))
		lines.push(`  ${flag}${padding}${desc}`)
	}
	return lines
}

function formatFlag(name, def) {
	let flag = `--${name}`
	if (def.type === 'string' || def.type === 'number') {
		const typeName = def.type === 'number' ? 'n' : 'value'
		flag += ` <${typeName}>`
	}
	if (def.short) flag = `-${def.short}, ${flag}`
	return flag
}

function formatDescription(def) {
	let desc = def.description || ''
	if (def.default !== undefined) desc += ` (default: ${def.default})`
	if (def.multiple) desc += ' (can be specified multiple times)'
	return desc
}

function formatExamples(examples) {
	if (!examples || examples.length === 0) return []
	return ['Examples:', ...examples.map((ex) => `  ${ex}`)]
}

main()
