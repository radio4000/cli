R4(1)                     User Commands                    R4(1)

NAME
       r4 - Radio4000 command-line interface

SYNOPSIS
       r4 <noun> <verb> [<args>] [flags]

DESCRIPTION
       Manage Radio4000 channels and tracks from the command line.
       All data is normalized through a zod schema. Commands output
       JSON by default and can generate SQL for SQLite imports.

COMMANDS
   Channel Operations
       r4 channel list
              List all channels (summary view)

       r4 channel view <slug>...
              View one or more channels in detail

       r4 channel create <slug> [options]
              Create a new channel (accepts JSON from stdin)

       r4 channel update <slug>... [options]
              Update one or more channels

       r4 channel delete <slug>...
              Delete one or more channels

   Track Operations
       r4 track list [--channel <slug>]...
              List all tracks, optionally filtered by channel(s)

       r4 track view <id>...
              View one or more tracks in detail

       r4 track create [options]
              Create a new track (accepts JSON from stdin)

       r4 track update <id>... [options]
              Update one or more tracks

       r4 track delete <id>...
              Delete one or more tracks

   Authentication
       r4 auth login
              Authenticate with Radio4000

       r4 auth logout
              Clear authentication

       r4 auth whoami
              Show current user and default channel

   Output Formats
       All read operations support:
       --json          Output as JSON (default)
       --sql           Output as SQL statements for SQLite

   Porcelain
       r4 add <url> [--channel <slug>]
              Smart track addition with metadata fetching

BACKLOG
       Search operations (or use: r4 track list --sql | rg <pattern>)
       r4 track search <query>
       r4 channel search <query>

EXAMPLES
       # View channels
       r4 channel list
       r4 channel view ko002 oskar

       # Create and update
       r4 channel create mysounds --name "My Sounds"
       r4 track create --url "..." --title "Song" --channel mysounds

       # Create from JSON (curl-style)
       echo '{"title":"Song","url":"..."}' | r4 track create --channel mysounds

       # Smart addition
       r4 add "https://youtube.com/..." --channel mysounds

       # Export specific channels to SQLite
       (r4 channel view ko002 oskar --sql; \
        r4 track list --channel ko002 --channel oskar --sql) | sqlite3 my.db

       # Export everything
       (r4 channel list --sql; r4 track list --sql) | sqlite3 full.db

       # Pipe and transform
       r4 track list --channel foo | jq '.[] | .title'
       r4 track list --channel old | jq 'map({title,url})' | r4 track create --channel new

SEE ALSO
       radio4000.com

R4 1.0                    2025-10-28                       R4(1)
