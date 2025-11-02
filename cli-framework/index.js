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
		const {default: commandDef} = await import(`file://${commandPath}`)
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
 * @returns {Promise<{commandFile: string, consumedSegments: number}>}
 */
async function routeCommand(commandsDir, commandPath) {
	if (commandPath.length === 0) {
		throw new CLIError(ErrorTypes.UNKNOWN_COMMAND, 'No command specified')
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
			return {
				commandFile: nextFile,
				consumedSegments: i + 1
			}
		}

		// Check if there's a directory to go deeper
		try {
			const stats = await stat(nextDir)
			if (stats.isDirectory()) {
				currentDir = nextDir
				consumedPath.push(segment)
				continue
			}
		} catch {
			// Path doesn't exist or isn't accessible
		}

		// No file or directory found - command doesn't exist
		const unknownCommand = consumedPath.concat(segment).join(' ')
		throw new CLIError(
			ErrorTypes.UNKNOWN_COMMAND,
			`Unknown command: ${unknownCommand}`
		)
	}

	// Reached end of path without finding a command file
	throw new CLIError(
		ErrorTypes.UNKNOWN_COMMAND,
		`'${consumedPath.join(' ')}' requires a subcommand`
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

	// Parse command path from argv (non-flag arguments at the beginning)
	const commandPath = []
	for (const arg of argv) {
		if (arg.startsWith('-')) break
		commandPath.push(arg)
	}
	const remainingArgv = argv.slice(commandPath.length)

	// Route to command file
	const {commandFile, consumedSegments} = await routeCommand(
		resolvedCommandsDir,
		commandPath
	)

	// Build argv: remaining command path segments + flags/options
	const commandArgv = [...commandPath.slice(consumedSegments), ...remainingArgv]

	// Load and validate command
	const command = await loadCommand(commandFile)

	// Add command name to context for help display
	const commandName = commandPath.join(' ')
	const extendedContext = {...context, commandName}

	// Execute command
	return await runCommand(command, commandArgv, extendedContext)
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
			} catch (_error) {
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

/**
 * Recursively list all commands in a directory tree
 * @param {string} commandsDir - Root directory containing commands
 * @param {string} prefix - Path prefix for nested commands
 * @returns {Promise<Array<{name: string, description: string, hidden: boolean}>>}
 */
export async function listAllCommands(commandsDir, prefix = '') {
	const commands = await discoverCommands(commandsDir)
	const result = []

	for (const cmd of commands) {
		const fullName = prefix ? `${prefix}/${cmd.name}` : cmd.name

		if (cmd.isDirectory) {
			// Recurse into subdirectories
			const subCommands = await listAllCommands(cmd.path, fullName)
			result.push(...subCommands)
		} else {
			try {
				const command = await loadCommand(cmd.path)
				result.push({
					name: fullName,
					description: command.description
				})
			} catch (_error) {
				// Skip commands that fail to load
			}
		}
	}

	return result
}
