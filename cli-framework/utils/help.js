/**
 * Help text generation from command definitions
 */
import {ErrorTypes} from '../types.js'

/**
 * Generate help text for a command
 * @param {Object} command - Command definition
 * @param {string} commandPath - Full command path (e.g., "r4 channel view")
 * @returns {string} Formatted help text
 */
export function generateCommandHelp(command, commandPath) {
	const lines = []

	// Usage section
	lines.push('USAGE')
	const usageParts = [commandPath]

	if (command.args.length > 0) {
		usageParts.push(
			...command.args.map((arg) => {
				let formatted = arg.name
				if (arg.multiple) formatted = `${formatted}...`
				return arg.required ? `<${formatted}>` : `[${formatted}]`
			})
		)
	}

	if (Object.keys(command.options).length > 0) {
		usageParts.push('[options]')
	}

	lines.push(`  ${usageParts.join(' ')}`)
	lines.push('')

	// Description section
	if (command.description) {
		lines.push('DESCRIPTION')
		lines.push(`  ${command.description}`)
		lines.push('')
	}

	// Arguments section
	if (command.args.length > 0) {
		lines.push('ARGUMENTS')

		const maxArgWidth = Math.max(
			...command.args.map((arg) => {
				let formatted = arg.name
				if (arg.multiple) formatted = `${formatted}...`
				return (arg.required ? `<${formatted}>` : `[${formatted}]`).length
			})
		)

		for (const arg of command.args) {
			let formatted = arg.name
			if (arg.multiple) formatted = `${formatted}...`
			const usage = arg.required ? `<${formatted}>` : `[${formatted}]`
			const padded = usage.padEnd(maxArgWidth + 4)
			const reqText = arg.required ? '(required)' : '(optional)'
			lines.push(`  ${padded}${arg.description} ${reqText}`)
		}
		lines.push('')
	}

	// Options section
	if (Object.keys(command.options).length > 0) {
		lines.push('OPTIONS')

		const flags = Object.entries(command.options).map(([name, def]) => {
			let flag = `--${name}`
			if (def.short) {
				flag = `-${def.short}, ${flag}`
			}
			if (def.type === 'string') {
				flag = `${flag} <value>`
			}
			return {
				flag,
				description: def.description,
				default: def.default
			}
		})

		const maxFlagWidth = Math.max(...flags.map((f) => f.flag.length))

		for (const {flag, description, default: defaultValue} of flags) {
			const padded = flag.padEnd(maxFlagWidth + 4)
			let desc = description
			if (defaultValue !== undefined) {
				desc = `${desc} (default: ${defaultValue})`
			}
			lines.push(`  ${padded}${desc}`)
		}
		lines.push('')
	}

	// Examples section
	if (command.examples && command.examples.length > 0) {
		lines.push('EXAMPLES')
		for (const example of command.examples) {
			lines.push(`  ${example}`)
		}
		lines.push('')
	}

	return lines.join('\n').trimEnd()
}

/**
 * Generate help text for a command group (directory)
 * @param {Array<{name: string, description: string, isDirectory: boolean}>} commands - Available commands
 * @param {string} commandPath - Current command path (e.g., "r4 channel")
 * @returns {string} Formatted help text
 */
export function generateGroupHelp(commands, commandPath) {
	const lines = []

	lines.push('USAGE')
	lines.push(`  ${commandPath} <command>`)
	lines.push('')

	if (commands.length > 0) {
		lines.push('COMMANDS')

		// Separate directories and files
		const dirs = commands.filter((cmd) => cmd.isDirectory)
		const files = commands.filter((cmd) => !cmd.isDirectory)

		// Show files first (actual commands)
		const allCommands = [...files, ...dirs]

		const maxNameWidth = Math.max(...allCommands.map((cmd) => cmd.name.length))

		for (const cmd of allCommands) {
			const padded = cmd.name.padEnd(maxNameWidth + 4)
			lines.push(`  ${padded}${cmd.description}`)
		}
		lines.push('')
	}

	lines.push(
		`Run '${commandPath} <command> --help' for more information on a command.`
	)

	return lines.join('\n').trimEnd()
}

/**
 * Generate help for top-level CLI (when no command specified)
 * @param {Array<{name: string, description: string, isDirectory: boolean}>} commands - Available commands
 * @param {string} programName - Program name (e.g., "r4")
 * @param {Object} options - Additional options
 * @param {string} options.description - CLI description
 * @param {string} options.version - CLI version
 * @returns {string} Formatted help text
 */
export function generateMainHelp(commands, programName, options = {}) {
	const lines = []

	if (options.version) {
		lines.push(`${programName} v${options.version}`)
	}

	if (options.description) {
		lines.push(options.description)
	}

	if (options.version || options.description) {
		lines.push('')
	}

	lines.push('USAGE')
	lines.push(`  ${programName} <command> [options]`)
	lines.push('')

	if (commands.length > 0) {
		lines.push('COMMANDS')

		const maxNameWidth = Math.max(...commands.map((cmd) => cmd.name.length))

		for (const cmd of commands) {
			const padded = cmd.name.padEnd(maxNameWidth + 4)
			lines.push(`  ${padded}${cmd.description}`)
		}
		lines.push('')
	}

	lines.push(
		`Run '${programName} <command> --help' for more information on a command.`
	)

	return lines.join('\n').trimEnd()
}

/**
 * Format a CLIError for display
 * @param {CLIError} error - The error to format
 * @returns {string} Formatted error message
 */
export function formatCLIError(error) {
	if (error.type === ErrorTypes.HELP_REQUESTED && error.context?.command) {
		return generateCommandHelp(
			error.context.command,
			error.context.commandName || ''
		)
	}

	if (error.type === ErrorTypes.UNKNOWN_COMMAND && error.context?.available) {
		let output = ''

		// If there's an unknown command (actual mistake), show it
		if (error.context.unknownCommand) {
			output += `Unknown command: ${error.context.unknownCommand}\n\n`
		}

		// Show available options
		const label = error.context.commandPath
			? 'Available subcommands:'
			: 'Available commands:'
		const commands = error.context.available
			.map((cmd) => `  ${cmd.name}`)
			.join('\n')
		output += `${label}\n${commands}`

		return output
	}

	// Actual errors
	let output = `Error: ${error.message}`
	if (error.context && Object.keys(error.context).length > 0) {
		output += `\nContext: ${JSON.stringify(error.context, null, 2)}`
	}
	return output
}
