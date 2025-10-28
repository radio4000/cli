import {describe, expect, test} from 'bun:test'
import {join} from 'node:path'
import {executeCommand, listCommands} from './index.js'
import {CLIError, ErrorTypes} from './types.js'

const FIXTURES_DIR = join(import.meta.dir, 'test-fixtures', 'commands')

describe('executeCommand - Routing', () => {
	test('routes to top-level command', async () => {
		const result = await executeCommand({
			commandsDir: FIXTURES_DIR,
			argv: ['simple']
		})

		expect(result).toEqual({success: true, command: 'simple'})
	})

	test('routes to nested command', async () => {
		const result = await executeCommand({
			commandsDir: FIXTURES_DIR,
			argv: ['channel', 'list']
		})

		expect(result).toEqual({
			success: true,
			command: 'channel:list',
			limit: undefined
		})
	})

	test('routes to nested command with arguments', async () => {
		const result = await executeCommand({
			commandsDir: FIXTURES_DIR,
			argv: ['channel', 'view', 'ko002']
		})

		expect(result).toEqual({
			success: true,
			command: 'channel:view',
			slug: 'ko002',
			json: true
		})
	})

	test('routes command with flags', async () => {
		const result = await executeCommand({
			commandsDir: FIXTURES_DIR,
			argv: ['channel', 'list', '--limit', '10']
		})

		expect(result).toEqual({
			success: true,
			command: 'channel:list',
			limit: 10
		})
	})

	test('routes command with args and flags', async () => {
		const result = await executeCommand({
			commandsDir: FIXTURES_DIR,
			argv: ['channel', 'view', 'ko002', '--json']
		})

		expect(result).toEqual({
			success: true,
			command: 'channel:view',
			slug: 'ko002',
			json: true
		})
	})

	test('throws error for unknown command', async () => {
		try {
			await executeCommand({
				commandsDir: FIXTURES_DIR,
				argv: ['nonexistent']
			})
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.UNKNOWN_COMMAND)
			expect(error.message).toContain('Unknown command')
		}
	})

	test('throws error for unknown nested command', async () => {
		try {
			await executeCommand({
				commandsDir: FIXTURES_DIR,
				argv: ['channel', 'nonexistent']
			})
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.UNKNOWN_COMMAND)
			expect(error.message).toContain('Unknown command')
		}
	})

	test('throws error when command group specified without subcommand', async () => {
		try {
			await executeCommand({
				commandsDir: FIXTURES_DIR,
				argv: ['channel']
			})
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.UNKNOWN_COMMAND)
			expect(error.message).toContain('requires a subcommand')
		}
	})

	test('throws error when no command specified', async () => {
		try {
			await executeCommand({
				commandsDir: FIXTURES_DIR,
				argv: []
			})
			expect(true).toBe(false) // should not reach
		} catch (error) {
			expect(error).toBeInstanceOf(CLIError)
			expect(error.type).toBe(ErrorTypes.UNKNOWN_COMMAND)
			expect(error.message).toContain('No command specified')
		}
	})
})

describe('executeCommand - Context', () => {
	test('passes context to command handler', async () => {
		const context = {auth: {token: 'test123'}}
		const result = await executeCommand({
			commandsDir: FIXTURES_DIR,
			argv: ['simple'],
			context
		})

		expect(result).toEqual({success: true, command: 'simple'})
	})
})

describe('listCommands', () => {
	test('lists top-level commands', async () => {
		const commands = await listCommands(FIXTURES_DIR)

		// Should have channel (directory) and simple (file)
		expect(commands.length).toBeGreaterThan(0)

		const simple = commands.find((cmd) => cmd.name === 'simple')
		expect(simple).toBeDefined()
		expect(simple?.description).toBe('A simple test command')
		expect(simple?.isDirectory).toBe(false)

		const channel = commands.find((cmd) => cmd.name === 'channel')
		expect(channel).toBeDefined()
		expect(channel?.isDirectory).toBe(true)
	})

	test('lists nested commands', async () => {
		const commands = await listCommands(join(FIXTURES_DIR, 'channel'))

		expect(commands.length).toBe(2)

		const list = commands.find((cmd) => cmd.name === 'list')
		expect(list).toBeDefined()
		expect(list?.description).toBe('List all channels')

		const view = commands.find((cmd) => cmd.name === 'view')
		expect(view).toBeDefined()
		expect(view?.description).toBe('View channel details')
	})

	test('returns empty array for non-existent directory', async () => {
		const commands = await listCommands('/nonexistent/path')
		expect(commands).toEqual([])
	})
})
