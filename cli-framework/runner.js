import {parseArgs} from 'node:util'
import {CLIError, ErrorTypes} from './types.js'

/**
 * Parse positional arguments according to command definition
 * @param {Array} argDefs - Argument definitions from command
 * @param {Array} positionals - Raw positional arguments from parseArgs
 * @returns {Object} Parsed arguments object
 */
function parsePositionalArgs(argDefs, positionals) {
	const parsed = {}
	let positionalIndex = 0

	for (const argDef of argDefs) {
		const {name, required, multiple} = argDef

		if (multiple) {
			// Collect all remaining positional arguments
			const values = positionals.slice(positionalIndex)
			if (required && values.length === 0) {
				throw new CLIError(
					ErrorTypes.MISSING_ARGUMENT,
					`Missing required argument: ${name}`,
					{argument: argDef}
				)
			}
			parsed[name] = values
			positionalIndex = positionals.length // consumed all
		} else {
			// Single argument
			const value = positionals[positionalIndex]
			if (required && value === undefined) {
				throw new CLIError(
					ErrorTypes.MISSING_ARGUMENT,
					`Missing required argument: ${name}`,
					{argument: argDef}
				)
			}
			if (value !== undefined) {
				parsed[name] = value
				positionalIndex++
			}
		}
	}

	// Check for extra positional arguments
	if (positionalIndex < positionals.length) {
		const extra = positionals.slice(positionalIndex)
		throw new CLIError(
			ErrorTypes.INVALID_ARGUMENT,
			`Unexpected arguments: ${extra.join(', ')}`,
			{extra}
		)
	}

	return parsed
}

/**
 * Parse and validate option values
 * @param {Object} optionDefs - Option definitions from command
 * @param {Object} values - Raw parsed values from parseArgs
 * @returns {Object} Parsed and validated option values
 */
function parseOptionValues(optionDefs, values) {
	const parsed = {}

	for (const [name, def] of Object.entries(optionDefs)) {
		const hasValue = name in values
		let value = values[name]

		// Check for required options
		if (def.required && !hasValue) {
			throw new CLIError(
				ErrorTypes.MISSING_ARGUMENT,
				`Missing required option: --${name}`,
				{option: name, definition: def}
			)
		}

		// For required boolean options, ensure the value is true
		if (def.required && def.type === 'boolean' && hasValue && value !== true) {
			throw new CLIError(
				ErrorTypes.INVALID_ARGUMENT,
				`Option --${name} must be true (received: ${value})`,
				{option: name, value, definition: def}
			)
		}

		// Use default if not provided
		if (!hasValue) {
			if (def.default !== undefined) {
				parsed[name] = def.default
			}
			continue
		}

		// Handle comma-separated values for multiple options
		// Support both --tag a --tag b AND --tag a,b,c
		if (def.multiple && typeof value === 'string' && value.includes(',')) {
			value = value
				.split(',')
				.map((v) => v.trim())
				.filter(Boolean)
		}
		// Also flatten if we got an array with comma-separated strings
		if (def.multiple && Array.isArray(value)) {
			value = value.flatMap((v) =>
				typeof v === 'string' && v.includes(',')
					? v
							.split(',')
							.map((x) => x.trim())
							.filter(Boolean)
					: v
			)
		}

		// Convert number type from string
		if (def.type === 'number' && typeof value === 'string') {
			const num = Number(value)
			if (Number.isNaN(num)) {
				throw new CLIError(
					ErrorTypes.INVALID_ARGUMENT,
					`Invalid number for --${name}: ${value}`,
					{option: name, value}
				)
			}
			value = num
		}

		// Apply custom parser if provided
		if (def.parse) {
			try {
				parsed[name] = def.parse(value)
			} catch (error) {
				throw new CLIError(
					ErrorTypes.INVALID_ARGUMENT,
					`Invalid value for --${name}: ${error.message}`,
					{option: name, value, error}
				)
			}
		} else {
			parsed[name] = value
		}
	}

	return parsed
}

/**
 * Build parseArgs options from command definition
 * @param {Object} optionDefs - Option definitions from command
 * @returns {Object} parseArgs-compatible options object
 */
function buildParseArgsOptions(optionDefs) {
	const options = {}

	for (const [name, def] of Object.entries(optionDefs)) {
		// Node.js parseArgs only supports 'boolean' and 'string'
		// Numbers will be parsed as strings and converted in parseOptionValues
		options[name] = {
			type: def.type === 'boolean' ? 'boolean' : 'string'
		}
		if (def.short) {
			options[name].short = def.short
		}
		if (def.multiple) {
			options[name].multiple = true
		}
	}

	return options
}

/**
 * Run a command with given arguments
 * @param {Object} command - Validated command definition
 * @param {Array} argv - Raw command line arguments (without program name and command path)
 * @param {Object} context - Shared context to pass to handler
 * @returns {Promise<any>} Result from command handler
 */
export async function runCommand(command, argv = [], context = {}) {
	try {
		// Check for help flags early, before validation
		if (argv.includes('--help') || argv.includes('-h')) {
			// Return a special signal that help was requested
			// The caller should handle showing help
			throw new CLIError(ErrorTypes.HELP_REQUESTED, 'Help requested', {
				command,
				commandName: context.commandName
			})
		}

		// Parse flags using Node.js built-in parseArgs
		const parseArgsOptions = buildParseArgsOptions(command.options)
		const {values, positionals} = parseArgs({
			args: argv,
			options: parseArgsOptions,
			strict: false, // allow unknown options for now
			allowPositionals: true
		})

		// Parse positional arguments
		const args = parsePositionalArgs(command.args, positionals)

		// Parse and validate option values
		const flags = parseOptionValues(command.options, values)

		// Merge args and flags for validation and handler
		const mergedInput = {...args, ...flags}

		// Run validation schema if provided
		let validatedInput = mergedInput
		if (command.validate) {
			try {
				validatedInput = command.validate.parse(mergedInput)
			} catch (error) {
				throw new CLIError(
					ErrorTypes.INVALID_ARGUMENT,
					`Validation failed: ${error.message}`,
					{zodError: error}
				)
			}
		}

		// Execute handler
		const result = await command.handler(validatedInput, context)

		return result
	} catch (error) {
		// Wrap non-CLI errors
		if (!(error instanceof CLIError)) {
			throw new CLIError(
				ErrorTypes.HANDLER_ERROR,
				`Command failed: ${error.message}`,
				{originalError: error}
			)
		}
		throw error
	}
}
