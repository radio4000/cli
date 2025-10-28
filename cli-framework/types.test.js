import {describe, expect, test} from 'bun:test'
import {
	ArgSchema,
	CLIError,
	CommandSchema,
	ErrorTypes,
	OptionSchema,
	validateCommandDefinition
} from './types.js'

describe('ArgSchema', () => {
	test('validates valid arg definition', () => {
		const arg = {
			name: 'slug',
			description: 'Channel slug',
			required: true,
			multiple: false
		}
		expect(() => ArgSchema.parse(arg)).not.toThrow()
	})

	test('sets default values', () => {
		const arg = ArgSchema.parse({
			name: 'slug',
			description: 'Channel slug'
		})
		expect(arg.required).toBe(false)
		expect(arg.multiple).toBe(false)
	})

	test('rejects invalid arg', () => {
		expect(() =>
			ArgSchema.parse({
				name: '',
				description: 'Invalid'
			})
		).toThrow()
	})
})

describe('OptionSchema', () => {
	test('validates boolean option', () => {
		const option = {
			type: 'boolean',
			description: 'Output as JSON',
			default: true
		}
		expect(() => OptionSchema.parse(option)).not.toThrow()
	})

	test('validates string option with short flag', () => {
		const option = {
			type: 'string',
			description: 'Limit results',
			short: 'l'
		}
		expect(() => OptionSchema.parse(option)).not.toThrow()
	})

	test('validates option with conflicts', () => {
		const option = {
			type: 'boolean',
			description: 'Output as SQL',
			conflicts: ['json', 'yaml']
		}
		expect(() => OptionSchema.parse(option)).not.toThrow()
	})

	test('rejects invalid type', () => {
		expect(() =>
			OptionSchema.parse({
				type: 'number',
				description: 'Invalid type'
			})
		).toThrow()
	})

	test('rejects invalid short flag (multiple chars)', () => {
		expect(() =>
			OptionSchema.parse({
				type: 'string',
				description: 'Invalid',
				short: 'ab'
			})
		).toThrow()
	})
})

describe('CommandSchema', () => {
	test('validates complete command definition', () => {
		const command = {
			description: 'View channels',
			args: [
				{
					name: 'slug',
					description: 'Channel slug',
					required: true,
					multiple: true
				}
			],
			options: {
				json: {
					type: 'boolean',
					description: 'Output as JSON',
					default: true
				},
				sql: {
					type: 'boolean',
					description: 'Output as SQL',
					conflicts: ['json']
				}
			},
			handler: async ({args, flags, context}) => {
				return args
			},
			examples: ['r4 channel view ko002', 'r4 channel view ko002 --sql']
		}

		expect(() => CommandSchema.parse(command)).not.toThrow()
	})

	test('validates minimal command definition', () => {
		const command = {
			description: 'Simple command',
			handler: async () => {}
		}

		const parsed = CommandSchema.parse(command)
		expect(parsed.args).toEqual([])
		expect(parsed.options).toEqual({})
	})

	test('rejects command without handler', () => {
		expect(() =>
			CommandSchema.parse({
				description: 'Invalid command'
			})
		).toThrow()
	})

	test('rejects command without description', () => {
		expect(() =>
			CommandSchema.parse({
				handler: async () => {}
			})
		).toThrow()
	})
})

describe('validateCommandDefinition', () => {
	test('validates valid command', () => {
		const command = {
			description: 'Test command',
			handler: async () => {}
		}

		const validated = validateCommandDefinition(command)
		expect(validated.description).toBe('Test command')
	})

	test('throws CLIError for invalid command', () => {
		try {
			validateCommandDefinition({
				description: 'Invalid'
				// missing handler
			})
			expect(true).toBe(false) // should not reach here
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.INVALID_COMMAND_DEFINITION)
			expect(error.message).toContain('Invalid command definition')
		}
	})
})

describe('CLIError', () => {
	test('creates error with type and context', () => {
		const error = new CLIError(
			ErrorTypes.UNKNOWN_COMMAND,
			'Command not found: foo',
			{available: ['bar', 'baz']}
		)

		expect(error).toBeInstanceOf(Error)
		expect(error.name).toBe('CLIError')
		expect(error.type).toBe(ErrorTypes.UNKNOWN_COMMAND)
		expect(error.message).toBe('Command not found: foo')
		expect(error.context).toEqual({available: ['bar', 'baz']})
	})
})
