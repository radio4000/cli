import {listAllCommands} from '../utils.js'

export default {
	description: 'Show help information',

	async run() {
		// Auto-discover all commands recursively from filesystem
		const allCommands = await listAllCommands()

		// Group commands by category (directory structure)
		const groups = {}
		for (const cmd of allCommands) {
			// Determine group from path (e.g., "channel/list" → "channel")
			const parts = cmd.name.split('/')
			if (parts.length > 1) {
				const group = parts[0]
				const subcommand = parts.slice(1).join(' ')
				if (!groups[group]) groups[group] = []
				groups[group].push({
					name: `${group} ${subcommand}`,
					description: cmd.description
				})
			} else {
				// Top-level commands go into "General"
				if (!groups.General) groups.General = []
				groups.General.push({name: cmd.name, description: cmd.description})
			}
		}

		// Generate COMMANDS section dynamically
		let commandsSection = ''
		const groupTitles = {
			channel: 'Channel Operations',
			track: 'Track Operations',
			tags: 'Tag Operations',
			auth: 'Authentication',
			General: 'General'
		}

		for (const [group, commands] of Object.entries(groups)) {
			const title =
				groupTitles[group] ||
				`${group.charAt(0).toUpperCase() + group.slice(1)} Operations`
			commandsSection += `   ${title}\n`
			for (const cmd of commands) {
				const padding = ' '.repeat(Math.max(1, 20 - cmd.name.length))
				commandsSection += `       ${cmd.name}${padding}${cmd.description}\n`
			}
			commandsSection += '\n'
		}

		const help = `
R4(1)                     User Commands                    R4(1)

NAME
       r4 - Radio4000 command-line interface

SYNOPSIS
       r4 <command> <subcommand> [<args>] [flags]

TLDR
       r4 channel list --limit 10      # List channels
       r4 channel view acapulco        # View channel details
       r4 track list                   # List all tracks
       r4 track list --channel foo     # List tracks in channel
       r4 auth login                   # Authenticate
       r4 help                         # Show this help
       r4 version                      # Show version

COMMANDS
${commandsSection.trimEnd()}

FLAGS
       --limit <n>     Limit number of results
       --sql           Output as SQL statements (instead of JSON)
       --channel <slug>
                       Filter tracks by channel slug

DATA SOURCES
       Read operations (list/view) use smart fallback:
       1. Query v2 API (Supabase)
       2. Fall back to bundled v1 data (read-only, ~600 channels)

       Write operations (create/update/delete) only work with v2.

AUTHENTICATION
       Set R4_AUTH_TOKEN environment variable or use 'r4 auth login'

EXAMPLES
       # List and view
       r4 channel list --limit 100
       r4 channel view acapulco oskar
       r4 track list
       r4 track list --channel acapulco

       # Create and update
       r4 channel create mysounds --name "My Sounds"
       r4 track create --url "..." --title "Song" --channel mysounds

       # Export to SQLite
       r4 channel list --limit 1000 --sql | sqlite3 channels.db

       # Pipe and transform
       r4 track list --channel foo | jq '.[] | .title'

       # Download
       r4 download acapulco --folder ~/Music

SEE ALSO
       https://radio4000.com
       https://github.com/radio4000/r4

R4 1.0                    2025-10-28                       R4(1)
`.trim()

		return help
	}
}
