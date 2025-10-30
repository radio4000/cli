import {z} from 'zod'

/**
 * Schema for argument definition
 * Defines positional arguments that commands accept
 */
export const ArgSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
	required: z.boolean().optional().default(false),
	multiple: z.boolean().optional().default(false) // accepts multiple values
})

/**
 * @typedef {z.infer<typeof ArgSchema>} Arg
 */

/**
 * Schema for option definition (flags)
 * Based on Node.js util.parseArgs format
 */
export const OptionSchema = z.object({
	type: z.enum(['boolean', 'string', 'number']),
	description: z.string(),
	required: z.boolean().optional(), // mark option as required
	default: z.union([z.boolean(), z.string(), z.number()]).optional(),
	short: z.string().length(1).optional(), // short flag like -h
	multiple: z.boolean().optional().default(false), // accepts multiple values
	parse: z.function().optional() // custom parser for validation/transformation
})

/**
 * @typedef {z.infer<typeof OptionSchema>} Option
 */

/**
 * Schema for command definition
 * This is what each command file should export
 */
export const CommandSchema = z.object({
	description: z.string(),
	args: z.array(ArgSchema).optional().default([]),
	options: z.record(z.string(), OptionSchema).optional().default({}),
	validate: z.unknown().optional(), // Zod schema for validation
	handler: z.function(),
	examples: z.array(z.string()).optional()
})

/**
 * @typedef {z.infer<typeof CommandSchema>} CommandDefinition
 */

/**
 * Custom error types for CLI
 */
export class CLIError extends Error {
	constructor(type, message, context = {}) {
		super(message)
		this.name = 'CLIError'
		this.type = type
		this.context = context
		Error.captureStackTrace(this, this.constructor)
	}
}

/**
 * Error types
 */
export const ErrorTypes = {
	UNKNOWN_COMMAND: 'unknown_command',
	MISSING_ARGUMENT: 'missing_argument',
	INVALID_ARGUMENT: 'invalid_argument',
	HANDLER_ERROR: 'handler_error',
	INVALID_COMMAND_DEFINITION: 'invalid_command_definition',
	HELP_REQUESTED: 'help_requested'
}

/**
 * Validate a command definition
 * @param {unknown} commandDef - The command definition to validate
 * @returns {object} The validated command definition
 * @throws {CLIError} If validation fails
 */
export function validateCommandDefinition(commandDef) {
	try {
		return CommandSchema.parse(commandDef)
	} catch (error) {
		throw new CLIError(
			ErrorTypes.INVALID_COMMAND_DEFINITION,
			`Invalid command definition: ${error.message}`,
			{zodError: error}
		)
	}
}
