import {existsSync} from 'node:fs'
import {readdir, stat} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {runCommand} from './runner.js'
import {CLIError, ErrorTypes, validateCommandDefinition} from './types.js'

/**
 * Load a command module from filesystem
 * @param {string} commandPath - Absolute path to command file
 * @returns {Promise<Object>} Validated command definition
 */
async function loadCommand(commandPath) {
	try {
		const module = await import(`file://${commandPath}`)
		const commandDef = module.default

		if (!commandDef) {
			throw new Error('Command file must export a default object')
		}

		return validateCommandDefinition(commandDef)
	} catch (error) {
		throw new CLIError(
			ErrorTypes.INVALID_COMMAND_DEFINITION,
			`Failed to load command from ${commandPath}: ${error.message}`,
			{path: commandPath, originalError: error}
		)
	}
}

/**
 * Discover available commands in a directory
 * @param {string} commandsDir - Directory containing command files
 * @returns {Promise<Array<{name: string, path: string, isDirectory: boolean}>>}
 */
async function discoverCommands(commandsDir) {
	if (!existsSync(commandsDir)) {
		return []
	}

	const entries = await readdir(commandsDir)
	const commands = []

	for (const entry of entries) {
		const fullPath = join(commandsDir, entry)
		const stats = await stat(fullPath)

		if (stats.isDirectory()) {
			commands.push({name: entry, path: fullPath, isDirectory: true})
		} else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
			const name = entry.replace(/\.js$/, '')
			commands.push({name, path: fullPath, isDirectory: false})
		}
	}

	return commands
}

/**
 * Route command path to filesystem location
 * @param {string} commandsDir - Root commands directory
 * @param {Array<string>} commandPath - Command path segments (e.g., ['channel', 'view'])
 * @returns {Promise<{commandFile: string, remainingArgs: Array<string>}>}
 */
async function routeCommand(commandsDir, commandPath) {
	if (commandPath.length === 0) {
		throw new CLIError(ErrorTypes.UNKNOWN_COMMAND, 'No command specified', {
			available: await discoverCommands(commandsDir)
		})
	}

	let currentDir = commandsDir
	const consumedPath = []

	// Try to match as deep as possible in the directory structure
	for (let i = 0; i < commandPath.length; i++) {
		const segment = commandPath[i]
		const nextDir = join(currentDir, segment)
		const nextFile = join(currentDir, `${segment}.js`)

		// Check if there's a file at this level
		if (existsSync(nextFile)) {
			consumedPath.push(segment)
			return {
				commandFile: nextFile,
				remainingArgs: commandPath.slice(i + 1)
			}
		}

		// Check if there's a directory to go deeper
		if (existsSync(nextDir)) {
			const stats = await stat(nextDir)
			if (stats.isDirectory()) {
				currentDir = nextDir
				consumedPath.push(segment)
				continue
			}
		}

		// No file or directory found - command doesn't exist
		const available = await discoverCommands(currentDir)
		const unknownCommand = consumedPath.concat(segment).join(' ')
		throw new CLIError(
			ErrorTypes.UNKNOWN_COMMAND,
			`Unknown command: ${unknownCommand}`,
			{segment, available, unknownCommand}
		)
	}

	// Reached end of path without finding a command file
	// This means they specified a directory but not a specific command
	const available = await discoverCommands(currentDir)
	throw new CLIError(
		ErrorTypes.UNKNOWN_COMMAND,
		`'${consumedPath.join(' ')}' requires a subcommand`,
		{available, commandPath: consumedPath.join(' ')}
	)
}

/**
 * Execute a CLI command
 * @param {Object} options - Router options
 * @param {string} options.commandsDir - Root directory containing commands
 * @param {Array<string>} options.argv - Raw command line arguments
 * @param {Object} options.context - Shared context for commands
 * @returns {Promise<any>} Result from command handler
 */
export async function executeCommand({commandsDir, argv, context = {}}) {
	// Resolve commands directory to absolute path
	const resolvedCommandsDir = resolve(commandsDir)

	// Parse command path from argv
	// argv starts with command segments, then flags and args
	// We need to figure out where command path ends and command args begin
	// Strategy: try to route progressively deeper until we find a command file
	const commandPath = []
	let remainingArgv = [...argv]

	// Extract command path (non-flag arguments from the beginning)
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg.startsWith('-')) {
			// Hit a flag, rest is command arguments
			break
		}
		commandPath.push(arg)
		remainingArgv = argv.slice(i + 1)
	}

	// Route to command file
	const {commandFile, remainingArgs} = await routeCommand(
		resolvedCommandsDir,
		commandPath
	)

	// Combine remaining path args with flags/options
	const commandArgv = [...remainingArgs, ...remainingArgv]

	// Load and validate command
	const command = await loadCommand(commandFile)

	// Execute command
	return await runCommand(command, commandArgv, context)
}

/**
 * List available commands in a directory
 * @param {string} commandsDir - Directory containing commands
 * @returns {Promise<Array<{name: string, description: string, isDirectory: boolean}>>}
 */
export async function listCommands(commandsDir) {
	const commands = await discoverCommands(commandsDir)
	const result = []

	for (const cmd of commands) {
		if (cmd.isDirectory) {
			result.push({
				name: cmd.name,
				description: 'Command group',
				isDirectory: true
			})
		} else {
			try {
				const command = await loadCommand(cmd.path)
				result.push({
					name: cmd.name,
					description: command.description,
					isDirectory: false
				})
			} catch (error) {
				// Skip commands that fail to load
				result.push({
					name: cmd.name,
					description: 'Error loading command',
					isDirectory: false
				})
			}
		}
	}

	return result
}
