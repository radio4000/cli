export default {
	description: 'Show help information',

	handler: async () => {
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
   Channel Operations
       list            List all channels (requires --limit)
       view <slug>     View channel details
       create          Create new channel (requires auth)
       update <slug>   Update channel (requires auth)
       delete <slug>   Delete channel (requires auth)
       download <slug> Download channel tracks with yt-dlp

   Track Operations
       list [--channel <slug>]
                       List all tracks, optionally filter by channel
       view <id>       View track details
       create          Create new track (requires auth)
       update <id>     Update track (requires auth)
       delete <id>     Delete track (requires auth)

   Authentication
       login           Authenticate with Radio4000
       logout          Clear authentication
       whoami          Show current user

   General
       help            Show this help
       version         Show version information

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
       r4 channel download acapulco --output ~/Music

SEE ALSO
       https://radio4000.com
       https://github.com/radio4000/r4

R4 1.0                    2025-10-28                       R4(1)
`.trim()

		return {
			data: help,
			format: 'text'
		}
	}
}
