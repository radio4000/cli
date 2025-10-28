R4(1)                     User Commands                    R4(1)

# CLI Implementation Plan

## Architecture Decisions
- **Style**: Functional, minimal ceremony
- **Framework**: Custom lightweight CLI framework (cli-framework/)
- **Data Sources**:
  - V1: Local JSON files in `cli/data/` (read-only, ~600 channels)
  - V2: Supabase via `@radio4000/sdk` (read/write)
- **Auth**: JWT stored in env var or config file
- **Schema**: Zod validation for all data (cli/lib/schema.js)

## Implementation Status

### ✅ Core Implementation Complete

### Channel Commands (cli/commands/channel/)
- [x] list.js - List all channels (v2 API + v1 fallback)
- [x] view.js - View channel details with multiple slugs support
- [x] create.js - Create new channel (v2 only, requires auth)
- [x] update.js - Update one or more channels (v2 only, requires auth)
- [x] delete.js - Delete one or more channels (v2 only, requires auth)

### Track Commands (cli/commands/track/)
- [x] list.js - List tracks with optional channel filter(s)
- [x] view.js - View track details for one or more IDs
- [x] create.js - Create new track (v2 only, requires auth)
- [x] update.js - Update one or more tracks (v2 only, requires auth)
- [x] delete.js - Delete one or more tracks (v2 only, requires auth)

### Auth Commands (cli/commands/auth/)
- [x] login.js - Authenticate with email/password, outputs JWT token
- [x] logout.js - Sign out from Radio4000
- [x] whoami.js - Show current authenticated user

### Future Porcelain Commands
- [ ] add.js - Smart track addition with URL metadata fetching
- [ ] download.js - Download channel tracks using yt-dlp (reuse from old CLI)

## Data Layer (cli/lib/)

### ✅ Implemented (cli/lib/data.js)
All pure functions, no classes:

**V1 Loaders (Bundled JSON fallback)**
- `loadV1Channels()` → Channel[] (cached)
- `loadV1Tracks()` → Track[] (cached, filters invalid)

**Auth Helpers**
- `getAuthToken()` → string | null (from R4_AUTH_TOKEN env var)
- `requireAuth()` → string | throws error

**Channel Operations**
- `listChannels()` → Channel[] (v2 + v1 fallback)
- `getChannel(slug)` → Channel (v2 + v1 fallback)
- `createChannel(data)` → Channel (v2, requires auth)
- `updateChannel(slug, updates)` → Channel (v2, requires auth, blocks v1)
- `deleteChannel(slug)` → {success, slug} (v2, requires auth, blocks v1)

**Track Operations**
- `listTracks({channelSlugs?})` → Track[] (v2 + v1 fallback)
- `getTrack(id)` → Track (v2 + v1 fallback)
- `createTrack(data)` → Track (v2, requires auth)
- `updateTrack(id, updates)` → Track (v2, requires auth, blocks v1)
- `deleteTrack(id)` → {success, id} (v2, requires auth, blocks v1)

**Auth Operations**
- `signIn(email, password)` → AuthData
- `signOut()` → {success}
- `readUser()` → User | null

### Schema (cli/lib/schema.js)
- `channelSchema` - Zod schema for channel validation
- `trackSchema` - Zod schema for track validation (strict: URL required)

---

NAME
       r4 - Radio4000 command-line interface

SYNOPSIS
       r4 <noun> <verb> [<args>] [flags]

DESCRIPTION
       Manage Radio4000 channels and tracks from the command line.
       All data is normalized through a zod schema. Commands output
       JSON by default and can generate SQL for SQLite imports.

   Data Sources
       Read operations (list/view) use smart fallback:
       1. Query v2 API (Supabase)
       2. Fall back to bundled v1 data (read-only, ~600 channels)

       Write operations (create/update/delete) only work with v2.
       Attempting to modify v1 channels returns an error.

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

   Download
       r4 download <slug> [--output <dir>] [--dry-run]
              Download all tracks from a channel using yt-dlp.
              Works with both v1 and v2 channels (read-only operation).

BACKLOG
       Search operations (or use: r4 track list --sql | rg <pattern>)
       r4 track search <query>
       r4 channel search <query>

EXAMPLES
       # View channels (from v2 or bundled v1)
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

       # Download tracks
       r4 download ko002
       r4 download oskar --output ~/Music --dry-run

SEE ALSO
       radio4000.com

R4 1.0                    2025-10-28                       R4(1)
