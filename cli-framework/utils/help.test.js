import {describe, expect, test} from 'bun:test'
import {
	generateCommandHelp,
	generateGroupHelp,
	generateMainHelp
} from './help.js'

describe('generateCommandHelp', () => {
	test('generates basic command help', () => {
		const command = {
			description: 'List all channels',
			args: [],
			options: {}
		}

		const help = generateCommandHelp(command, 'r4 channel list')

		expect(help).toContain('USAGE')
		expect(help).toContain('r4 channel list')
		expect(help).toContain('DESCRIPTION')
		expect(help).toContain('List all channels')
	})

	test('generates help with required argument', () => {
		const command = {
			description: 'View channel details',
			args: [
				{
					name: 'slug',
					description: 'Channel slug',
					required: true,
					multiple: false
				}
			],
			options: {}
		}

		const help = generateCommandHelp(command, 'r4 channel view')

		expect(help).toContain('<slug>')
		expect(help).toContain('ARGUMENTS')
		expect(help).toContain('Channel slug')
		expect(help).toContain('(required)')
	})

	test('generates help with optional argument', () => {
		const command = {
			description: 'Test command',
			args: [
				{
					name: 'slug',
					description: 'Channel slug',
					required: false,
					multiple: false
				}
			],
			options: {}
		}

		const help = generateCommandHelp(command, 'r4 test')

		expect(help).toContain('[slug]')
		expect(help).toContain('(optional)')
	})

	test('generates help with multiple arguments', () => {
		const command = {
			description: 'View channels',
			args: [
				{
					name: 'slugs',
					description: 'Channel slugs',
					required: true,
					multiple: true
				}
			],
			options: {}
		}

		const help = generateCommandHelp(command, 'r4 channel view')

		expect(help).toContain('<slugs...>')
		expect(help).toContain('Channel slugs')
	})

	test('generates help with boolean option', () => {
		const command = {
			description: 'List channels',
			args: [],
			options: {
				json: {
					type: 'boolean',
					description: 'Output as JSON',
					default: true
				}
			}
		}

		const help = generateCommandHelp(command, 'r4 channel list')

		expect(help).toContain('OPTIONS')
		expect(help).toContain('--json')
		expect(help).toContain('Output as JSON')
		expect(help).toContain('(default: true)')
	})

	test('generates help with string option', () => {
		const command = {
			description: 'List channels',
			args: [],
			options: {
				format: {
					type: 'string',
					description: 'Output format'
				}
			}
		}

		const help = generateCommandHelp(command, 'r4 channel list')

		expect(help).toContain('--format <value>')
		expect(help).toContain('Output format')
	})

	test('generates help with short flag', () => {
		const command = {
			description: 'Test command',
			args: [],
			options: {
				verbose: {
					type: 'boolean',
					short: 'v',
					description: 'Verbose output'
				}
			}
		}

		const help = generateCommandHelp(command, 'r4 test')

		expect(help).toContain('-v, --verbose')
	})

	test('generates help with examples', () => {
		const command = {
			description: 'View channels',
			args: [{name: 'slug', required: true, multiple: false}],
			options: {},
			examples: ['r4 channel view ko002', 'r4 channel view oskar']
		}

		const help = generateCommandHelp(command, 'r4 channel view')

		expect(help).toContain('EXAMPLES')
		expect(help).toContain('r4 channel view ko002')
		expect(help).toContain('r4 channel view oskar')
	})

	test('generates complete help with all sections', () => {
		const command = {
			description: 'View one or more channels',
			args: [
				{
					name: 'slugs',
					description: 'Channel slugs to view',
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
					description: 'Output as SQL'
				},
				limit: {
					type: 'string',
					short: 'l',
					description: 'Limit results'
				}
			},
			examples: ['r4 channel view ko002', 'r4 channel view ko002 oskar --sql']
		}

		const help = generateCommandHelp(command, 'r4 channel view')

		// Check all sections present
		expect(help).toContain('USAGE')
		expect(help).toContain('DESCRIPTION')
		expect(help).toContain('ARGUMENTS')
		expect(help).toContain('OPTIONS')
		expect(help).toContain('EXAMPLES')

		// Check content
		expect(help).toContain('<slugs...>')
		expect(help).toContain('View one or more channels')
		expect(help).toContain('--json')
		expect(help).toContain('--sql')
		expect(help).toContain('-l, --limit <value>')
	})
})

describe('generateGroupHelp', () => {
	test('generates help for command group', () => {
		const commands = [
			{name: 'list', description: 'List all channels', isDirectory: false},
			{name: 'view', description: 'View channel details', isDirectory: false},
			{
				name: 'create',
				description: 'Create a new channel',
				isDirectory: false
			}
		]

		const help = generateGroupHelp(commands, 'r4 channel')

		expect(help).toContain('USAGE')
		expect(help).toContain('r4 channel <command>')
		expect(help).toContain('COMMANDS')
		expect(help).toContain('list')
		expect(help).toContain('List all channels')
		expect(help).toContain('view')
		expect(help).toContain('View channel details')
		expect(help).toContain("Run 'r4 channel <command> --help'")
	})

	test('shows subdirectories', () => {
		const commands = [
			{name: 'list', description: 'List tracks', isDirectory: false},
			{name: 'meta', description: 'Command group', isDirectory: true}
		]

		const help = generateGroupHelp(commands, 'r4 track')

		expect(help).toContain('list')
		expect(help).toContain('meta')
	})

	test('handles empty command list', () => {
		const help = generateGroupHelp([], 'r4 empty')

		expect(help).toContain('USAGE')
		expect(help).toContain('r4 empty <command>')
	})
})

describe('generateMainHelp', () => {
	test('generates main CLI help', () => {
		const commands = [
			{name: 'channel', description: 'Manage channels', isDirectory: true},
			{name: 'track', description: 'Manage tracks', isDirectory: true},
			{name: 'add', description: 'Add a track', isDirectory: false}
		]

		const help = generateMainHelp(commands, 'r4', {
			version: '1.0.0',
			description: 'Radio4000 CLI'
		})

		expect(help).toContain('r4 v1.0.0')
		expect(help).toContain('Radio4000 CLI')
		expect(help).toContain('USAGE')
		expect(help).toContain('r4 <command>')
		expect(help).toContain('COMMANDS')
		expect(help).toContain('channel')
		expect(help).toContain('Manage channels')
		expect(help).toContain('track')
		expect(help).toContain('add')
		expect(help).toContain("Run 'r4 <command> --help'")
	})

	test('generates help without version or description', () => {
		const commands = [
			{name: 'test', description: 'Test command', isDirectory: false}
		]

		const help = generateMainHelp(commands, 'cli')

		expect(help).not.toContain('v')
		expect(help).toContain('USAGE')
		expect(help).toContain('cli <command>')
	})

	test('handles empty commands', () => {
		const help = generateMainHelp([], 'cli')

		expect(help).toContain('USAGE')
		expect(help).toContain('cli <command>')
	})
})
