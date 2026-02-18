import {aliases, listAllCommands} from '../utils.js'

/** Get alias for a command name (e.g., 'list' → 'ls') */
function getAliasFor(cmdName) {
	for (const [alias, canonical] of Object.entries(aliases)) {
		if (canonical === cmdName) return alias
	}
	return null
}

export default {
	description: 'Show help information',

	async run() {
		// Auto-discover all commands recursively from filesystem
		const allCommands = await listAllCommands()

		// Group commands by category (directory structure)
		const groups = {}
		for (const cmd of allCommands) {
			// Determine group from command name (e.g., "channel list" → "channel")
			const parts = cmd.name.split(' ')
			if (parts.length > 1) {
				const group = parts[0]
				const subcommand = parts.slice(1).join(' ')
				if (!groups[group]) groups[group] = []
				groups[group].push({
					name: subcommand,
					fullName: cmd.name,
					description: cmd.description
				})
			} else {
				// Top-level commands go into "General"
				if (!groups.General) groups.General = []
				groups.General.push({
					name: cmd.name,
					fullName: cmd.name,
					description: cmd.description
				})
			}
		}

		// Generate COMMANDS section dynamically
		let commandsSection = ''
		const groupTitles = {
			channel: 'Channel',
			track: 'Track',
			tags: 'Tags',
			auth: 'Auth',
			General: 'General'
		}

		// Order groups: General first, then alphabetically
		const orderedGroups = [
			'General',
			...Object.keys(groups)
				.filter((g) => g !== 'General')
				.sort()
		]

		for (const group of orderedGroups) {
			const commands = groups[group]
			if (!commands) continue

			const title =
				groupTitles[group] || group.charAt(0).toUpperCase() + group.slice(1)
			commandsSection += `   ${title}\n`
			for (const cmd of commands) {
				// Check if the subcommand has an alias
				const alias = getAliasFor(cmd.name)
				const displayName = alias ? `${cmd.name} (${alias})` : cmd.name
				const padding = ' '.repeat(Math.max(1, 20 - displayName.length))
				commandsSection += `       ${displayName}${padding}${cmd.description}\n`
			}
			commandsSection += '\n'
		}

		const help = `
r4 - Radio4000 CLI

Usage: r4 <command> [options]       (add --help to any command)

Examples:
       r4 channel list --limit 10                        # Discover channels
       r4 channel view ko002                             # View a channel
       r4 track list --channel ko002                     # List its tracks
       r4 track list --channel ko002 | jq '.[].title'    # Pipe to jq
       r4 download ko002 --output ~/Music                # Download tracks
       r4 channel create myradio --name "My Radio"       # Create your own
       r4 track create --url "..." --channel myradio     # Add a track
       r4 channel list --format sql | sqlite3 r4.db      # Export to SQLite

COMMANDS
${commandsSection.trimEnd()}

FLAGS
       --limit <n>  --format <text|json|sql|m3u>  --channel <slug>

MORE
       https://radio4000.com - https://github.com/radio4000/cli
`.trim()

		return help
	}
}
