import {existsSync} from 'node:fs'
import {readdir, stat} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {parseArgs} from 'node:util'

/**
 * Route argv to a command file
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {Promise<{commandFile: string, commandArgv: string[], commandName: string}>}
 */
export async function route(argv) {
	const __dirname = dirname(fileURLToPath(import.meta.url))
	const resolvedDir = resolve(__dirname, 'commands')

	// Extract command path (non-flag args at start)
	const commandPath = []
	for (const arg of argv) {
		if (arg.startsWith('-')) break
		commandPath.push(arg)
	}

	if (commandPath.length === 0) {
		throw new Error('No command specified')
	}

	// Walk directory structure to find command file
	let currentDir = resolvedDir
	for (let i = 0; i < commandPath.length; i++) {
		const segment = commandPath[i]
		const file = join(currentDir, `${segment}.js`)
		const dir = join(currentDir, segment)

		// Found a command file?
		if (existsSync(file)) {
			return {
				commandFile: file,
				commandArgv: argv.slice(i + 1), // remaining args
				commandName: commandPath.slice(0, i + 1).join(' ')
			}
		}

		// Is it a directory? Go deeper
		if (existsSync(dir) && (await stat(dir)).isDirectory()) {
			currentDir = dir
			continue
		}

		// Not found
		throw new Error(`Unknown command: ${commandPath.slice(0, i + 1).join(' ')}`)
	}

	// Reached end without finding a .js file
	throw new Error(`'${commandPath.join(' ')}' requires a subcommand`)
}

/**
 * Parse argv with conveniences over Node's parseArgs
 * - Converts type:'number' from string to number
 * - Splits comma-separated values for multiple:true
 *
 * @param {string[]} argv - Command arguments
 * @param {object} options - parseArgs options config
 * @returns {{values: object, positionals: string[]}}
 */
export function parse(argv, options = {}) {
	// Build parseArgs config (only supports 'boolean' and 'string')
	const parseArgsOpts = {}

	for (const [name, def] of Object.entries(options)) {
		parseArgsOpts[name] = {
			type: def.type === 'boolean' ? 'boolean' : 'string'
		}
		if (def.short) parseArgsOpts[name].short = def.short
		if (def.multiple) parseArgsOpts[name].multiple = true
	}

	// Parse
	const {values, positionals} = parseArgs({
		args: argv,
		options: parseArgsOpts,
		allowPositionals: true,
		strict: false
	})

	// Post-process: numbers, defaults, comma-separated values
	for (const [name, def] of Object.entries(options)) {
		// Convert numbers
		if (def.type === 'number' && values[name] !== undefined) {
			const num = Number(values[name])
			if (Number.isNaN(num)) {
				throw new Error(`Invalid number for --${name}: ${values[name]}`)
			}
			values[name] = num
		}

		// Apply defaults
		if (def.default !== undefined && values[name] === undefined) {
			values[name] = def.default
		}

		// Split comma-separated values
		if (def.multiple && values[name]) {
			const arr = Array.isArray(values[name]) ? values[name] : [values[name]]
			values[name] = arr.flatMap((v) =>
				typeof v === 'string' && v.includes(',')
					? v
							.split(',')
							.map((x) => x.trim())
							.filter(Boolean)
					: v
			)
		}
	}

	return {values, positionals}
}

/**
 * List all commands recursively
 * @param {string} [commandsDir] - Internal: directory for recursion
 * @param {string} prefix - Internal: path prefix for recursion
 * @returns {Promise<Array<{name: string, description: string}>>}
 */
export async function listAllCommands(commandsDir, prefix = '') {
	// Default to cli/commands directory
	if (!commandsDir) {
		const __dirname = dirname(fileURLToPath(import.meta.url))
		commandsDir = resolve(__dirname, 'commands')
	}
	const entries = await readdir(commandsDir)
	const result = []

	for (const entry of entries) {
		const fullPath = join(commandsDir, entry)
		const stats = await stat(fullPath)
		const name = prefix ? `${prefix}/${entry}` : entry

		if (stats.isDirectory()) {
			// Recurse
			const subCommands = await listAllCommands(fullPath, name)
			result.push(...subCommands)
		} else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) {
			// Load command and get description
			try {
				const {default: cmd} = await import(`file://${fullPath}`)
				const cmdName = name.replace(/\.js$/, '').replace(/\//g, ' ')
				result.push({
					name: cmdName,
					description: cmd.description || 'No description'
				})
			} catch {
				// Skip commands that fail to load
			}
		}
	}

	return result
}
