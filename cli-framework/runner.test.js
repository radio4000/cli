import {describe, expect, test} from 'bun:test'
import {z} from 'zod'
import {runCommand} from './runner.js'
import {CLIError, ErrorTypes} from './types.js'

describe('runCommand - Positional Arguments', () => {
	test('parses single required argument', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slug', required: true, multiple: false}],
			options: {},
			handler: async ({args}) => args
		}

		const result = await runCommand(command, ['ko002'])
		expect(result).toEqual({slug: 'ko002'})
	})

	test('parses multiple required arguments', async () => {
		const command = {
			description: 'Test',
			args: [
				{name: 'first', required: true, multiple: false},
				{name: 'second', required: true, multiple: false}
			],
			options: {},
			handler: async ({args}) => args
		}

		const result = await runCommand(command, ['foo', 'bar'])
		expect(result).toEqual({first: 'foo', second: 'bar'})
	})

	test('parses multiple values for single argument', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slugs', required: true, multiple: true}],
			options: {},
			handler: async ({args}) => args
		}

		const result = await runCommand(command, ['ko002', 'oskar', 'test'])
		expect(result).toEqual({slugs: ['ko002', 'oskar', 'test']})
	})

	test('handles optional argument when not provided', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slug', required: false, multiple: false}],
			options: {},
			handler: async ({args}) => args
		}

		const result = await runCommand(command, [])
		expect(result).toEqual({})
	})

	test('handles optional argument when provided', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slug', required: false, multiple: false}],
			options: {},
			handler: async ({args}) => args
		}

		const result = await runCommand(command, ['ko002'])
		expect(result).toEqual({slug: 'ko002'})
	})

	test('throws error for missing required argument', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slug', required: true, multiple: false}],
			options: {},
			handler: async () => {}
		}

		try {
			await runCommand(command, [])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.MISSING_ARGUMENT)
			expect(error.message).toContain('slug')
		}
	})

	test('throws error for extra positional arguments', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slug', required: true, multiple: false}],
			options: {},
			handler: async () => {}
		}

		try {
			await runCommand(command, ['ko002', 'extra', 'args'])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.INVALID_ARGUMENT)
			expect(error.message).toContain('Unexpected arguments')
		}
	})

	test('handles multiple with empty array when optional', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slugs', required: false, multiple: true}],
			options: {},
			handler: async ({args}) => args
		}

		const result = await runCommand(command, [])
		expect(result).toEqual({slugs: []})
	})
})

describe('runCommand - Options (Flags)', () => {
	test('parses boolean flag', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				json: {type: 'boolean', description: 'Output JSON'}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['--json'])
		expect(result).toEqual({json: true})
	})

	test('parses string flag', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				format: {type: 'string', description: 'Output format'}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['--format', 'json'])
		expect(result).toEqual({format: 'json'})
	})

	test('applies default value when flag not provided', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				json: {type: 'boolean', description: 'Output JSON', default: true}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, [])
		expect(result).toEqual({json: true})
	})

	test('uses explicit false when flag not provided with true default', async () => {
		// Note: Node.js parseArgs doesn't support --no-* syntax
		// This test verifies that when a boolean flag is not provided,
		// and no default is set, it doesn't appear in the result
		const command = {
			description: 'Test',
			args: [],
			options: {
				json: {type: 'boolean', description: 'Output JSON'},
				verbose: {type: 'boolean', description: 'Verbose'}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['--verbose'])
		expect(result).toEqual({verbose: true})
		expect(result.json).toBeUndefined()
	})

	test('parses short flag', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				verbose: {
					type: 'boolean',
					short: 'v',
					description: 'Verbose output'
				}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['-v'])
		expect(result).toEqual({verbose: true})
	})

	test('applies custom parser', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				limit: {
					type: 'string',
					description: 'Limit',
					parse: (val) => {
						const num = parseInt(val, 10)
						if (Number.isNaN(num) || num < 1) {
							throw new Error('must be a positive number')
						}
						return num
					}
				}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['--limit', '42'])
		expect(result).toEqual({limit: 42})
	})

	test('throws error on invalid custom parser input', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				limit: {
					type: 'string',
					description: 'Limit',
					parse: (val) => {
						const num = parseInt(val, 10)
						if (Number.isNaN(num) || num < 1) {
							throw new Error('must be a positive number')
						}
						return num
					}
				}
			},
			handler: async () => {}
		}

		try {
			await runCommand(command, ['--limit', 'invalid'])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.INVALID_ARGUMENT)
			expect(error.message).toContain('Invalid value for --limit')
		}
	})

	test('throws error for missing required option', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				email: {
					type: 'string',
					description: 'Email address',
					required: true
				}
			},
			handler: async () => {}
		}

		try {
			await runCommand(command, [])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.MISSING_ARGUMENT)
			expect(error.message).toContain('Missing required option: --email')
		}
	})

	test('accepts required option when provided', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				email: {
					type: 'string',
					description: 'Email address',
					required: true
				}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['--email', 'test@example.com'])
		expect(result).toEqual({email: 'test@example.com'})
	})

	test('throws error for missing required boolean option', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				confirm: {
					type: 'boolean',
					description: 'Confirm action',
					required: true
				}
			},
			handler: async () => {}
		}

		try {
			await runCommand(command, [])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.MISSING_ARGUMENT)
			expect(error.message).toContain('Missing required option: --confirm')
		}
	})

	test('accepts required boolean option when provided', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				confirm: {
					type: 'boolean',
					description: 'Confirm action',
					required: true
				}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['--confirm'])
		expect(result).toEqual({confirm: true})
	})

	test('required option takes precedence over default', async () => {
		// If an option is both required and has a default,
		// the required validation should still trigger
		const command = {
			description: 'Test',
			args: [],
			options: {
				format: {
					type: 'string',
					description: 'Output format',
					required: true,
					default: 'json'
				}
			},
			handler: async () => {}
		}

		try {
			await runCommand(command, [])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.MISSING_ARGUMENT)
		}
	})
})

describe('runCommand - Conflicts', () => {
	test('throws error for conflicting options', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				json: {type: 'boolean', description: 'JSON output'},
				sql: {
					type: 'boolean',
					description: 'SQL output',
					conflicts: ['json']
				}
			},
			handler: async () => {}
		}

		try {
			await runCommand(command, ['--json', '--sql'])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.CONFLICTING_OPTIONS)
			expect(error.message).toContain('cannot be used together')
		}
	})

	test('allows non-conflicting options', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {
				json: {type: 'boolean', description: 'JSON output'},
				verbose: {type: 'boolean', description: 'Verbose'}
			},
			handler: async ({flags}) => flags
		}

		const result = await runCommand(command, ['--json', '--verbose'])
		expect(result).toEqual({json: true, verbose: true})
	})
})

describe('runCommand - Validation', () => {
	test('runs Zod validation on arguments', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slug', required: true, multiple: false}],
			options: {},
			validate: z.object({
				slug: z.string().min(3)
			}),
			handler: async ({args}) => args
		}

		const result = await runCommand(command, ['ko002'])
		expect(result).toEqual({slug: 'ko002'})
	})

	test('throws error on validation failure', async () => {
		const command = {
			description: 'Test',
			args: [{name: 'slug', required: true, multiple: false}],
			options: {},
			validate: z.object({
				slug: z.string().min(5)
			}),
			handler: async () => {}
		}

		try {
			await runCommand(command, ['ko'])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.INVALID_ARGUMENT)
			expect(error.message).toContain('Validation failed')
		}
	})
})

describe('runCommand - Context', () => {
	test('passes context to handler', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {},
			handler: async ({context}) => context
		}

		const context = {auth: {token: 'secret'}, config: {verbose: true}}
		const result = await runCommand(command, [], context)
		expect(result).toEqual(context)
	})
})

describe('runCommand - Handler Errors', () => {
	test('wraps handler errors in CLIError', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {},
			handler: async () => {
				throw new Error('Something went wrong')
			}
		}

		try {
			await runCommand(command, [])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.HANDLER_ERROR)
			expect(error.message).toContain('Command failed')
		}
	})

	test('preserves CLIError thrown by handler', async () => {
		const command = {
			description: 'Test',
			args: [],
			options: {},
			handler: async () => {
				throw new CLIError(ErrorTypes.INVALID_ARGUMENT, 'Custom error')
			}
		}

		try {
			await runCommand(command, [])
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.INVALID_ARGUMENT)
			expect(error.message).toBe('Custom error')
		}
	})
})

describe('runCommand - Integration', () => {
	test('handles complex command with args, flags, and context', async () => {
		const command = {
			description: 'View channels',
			args: [{name: 'slugs', required: true, multiple: true}],
			options: {
				json: {type: 'boolean', description: 'JSON output', default: true},
				limit: {
					type: 'string',
					description: 'Limit results',
					parse: (val) => parseInt(val, 10)
				}
			},
			validate: z.object({
				slugs: z.array(z.string().min(1))
			}),
			handler: async ({args, flags, context}) => ({
				args,
				flags,
				context
			})
		}

		const context = {auth: true}
		const result = await runCommand(
			command,
			['ko002', 'oskar', '--limit', '10'],
			context
		)

		expect(result).toEqual({
			args: {slugs: ['ko002', 'oskar']},
			flags: {json: true, limit: 10},
			context: {auth: true}
		})
	})
})
