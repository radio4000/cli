R4(1)                     User Commands                    R4(1)

# CLI Implementation Plan

## Status: ✅ Production Ready (v1.0.4)

All core features implemented and tested (2025-10-28). CLI is fully functional with proper Unix-style piping, fallback data sources, and comprehensive documentation.

### Quick Reference
- **Version**: v1.0.4
- **Commands**: channel (list/view/create/update/delete/download), track (list/view/create/update/delete), auth (login/logout/whoami), help, version
- **Output**: JSON (default), SQL (--sql flag)
- **Data**: V2 API (Supabase) with V1 fallback (~600 bundled channels)
- **Auth**: JWT via R4_AUTH_TOKEN env var
- **Piping**: ✅ All commands pipe cleanly to jq and Unix tools

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

All commands tested and working as of 2025-10-28.

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

### General Commands (cli/commands/)
- [x] help.js - Show manpage-style help with TLDR section
- [x] version.js - Show version number (hugo-style)

### Download Commands (cli/commands/channel/)
- [x] download.js - Download channel tracks using yt-dlp

### Future Porcelain Commands
- [ ] add.js - Smart track addition with URL metadata fetching

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

## Testing Summary (2025-10-28)

### ✅ Verified Working
- **Channel operations**: list (with --limit), view (single/multiple slugs)
- **Track operations**: list (with/without --channel filter), view
- **Auth commands**: whoami, login/logout flow
- **Output formats**: JSON (default), SQL (--sql flag)
- **Piping**: All commands pipe correctly to jq and other Unix tools
- **Multi-value support**: Can view/update multiple channels/tracks at once
- **V1 fallback**: Gracefully falls back to bundled data when API unavailable
- **Error handling**: Clear error messages for missing resources, auth errors
- **Help system**: `r4 help` shows comprehensive manpage-style documentation
- **Version command**: `r4 version` outputs `r4 v1.0.4`

### ✅ Piping Tests (All Passed)
```bash
r4 channel list --limit 5 | jq '.[0].slug'                    # ✓ Works
r4 channel list --limit 100 | jq 'length'                     # ✓ Works
r4 channel list --limit 5 | jq '.[] | select(.track_count > 100)'  # ✓ Works
r4 channel view oskar ko002 | jq '.[].name'                   # ✓ Works
r4 channel list --limit 100 2>/dev/null | jq '.[0]'          # ✓ Works (stderr suppressed)
```

### ⚠️ Known Limitations
- `--help` flag doesn't work on subcommands (framework issue)
- `r4 channel list` requires `--limit` flag (intentional design)
- Stderr messages appear after JSON (Unix-correct but could add --quiet)
- Download command mixes human-readable and JSON output

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
       1. Query v2 API (Supabase via @radio4000/sdk)
       2. Fall back to bundled v1 data (read-only, ~600 channels)

       When API is unavailable, informational message goes to stderr:
       "API unavailable, using bundled v1 data"

       To suppress stderr messages in scripts:
       r4 channel list --limit 10 2>/dev/null

       Write operations (create/update/delete) only work with v2 API.
       Attempting to modify v1 channels returns an error.

   Output Formats
       Default: JSON to stdout, logs to stderr (Unix-style)
       --json (default)    Pretty-printed JSON for piping to jq
       --sql               SQL INSERT statements for SQLite import

       All commands pipe cleanly to jq and other Unix tools:
       r4 channel list --limit 100 | jq '.[] | select(.track_count > 500)'

COMMANDS
   Channel Operations
       r4 channel list --limit <n>
              List channels (requires --limit 1-4000)
              Returns: JSON array of channel objects
              Note: --limit is required to prevent accidentally loading all data

       r4 channel view <slug>...
              View one or more channels in detail
              Multiple slugs: r4 channel view ko002 oskar
              Returns: Single object (one slug) or array (multiple slugs)

       r4 channel create <slug> [options]
              Create a new channel (requires auth, v2 only)
              Accepts JSON from stdin for bulk operations

       r4 channel update <slug>... [options]
              Update one or more channels (requires auth, v2 only)
              Cannot update v1 channels

       r4 channel delete <slug>...
              Delete one or more channels (requires auth, v2 only)
              Cannot delete v1 channels

       r4 channel download <slug> [--output <dir>] [--dry-run]
              Download all tracks from a channel using yt-dlp
              Works with both v1 and v2 channels (read-only)
              Requires: yt-dlp installed on system

   Track Operations
       r4 track list [--channel <slug>]...
              List tracks, optionally filtered by channel(s)
              Without --channel: requires v1 fallback (API can't list all)
              Multiple channels: r4 track list --channel foo --channel bar
              Returns: JSON array of track objects

       r4 track view <id>...
              View one or more tracks in detail
              Multiple IDs: r4 track view abc123 def456
              Returns: Single object (one ID) or array (multiple IDs)

       r4 track create [options]
              Create a new track (requires auth, v2 only)
              Accepts JSON from stdin for bulk operations

       r4 track update <id>... [options]
              Update one or more tracks (requires auth, v2 only)
              Cannot update v1 tracks

       r4 track delete <id>...
              Delete one or more tracks (requires auth, v2 only)
              Cannot delete v1 tracks

   Authentication
       r4 auth login
              Authenticate with Radio4000
              Prompts for email/password, outputs JWT token
              Set R4_AUTH_TOKEN env var to use the token

       r4 auth logout
              Clear authentication (sign out from API)

       r4 auth whoami
              Show current authenticated user
              Returns: User object or {"authenticated": false}

   General
       r4 help
              Show this manpage-style documentation with TLDR

       r4 version
              Show version (format: r4 v1.0.4)

TLDR
       r4 help                              # Show full help
       r4 version                           # Show version (r4 v1.0.4)
       r4 channel list --limit 10           # List 10 channels
       r4 channel view ko002                # View channel details
       r4 track list --channel foo          # List tracks in channel
       r4 auth login                        # Authenticate
       r4 auth whoami                       # Show current user

       # Piping examples
       r4 channel list --limit 100 | jq '.[] | .slug'
       r4 channel list --limit 50 2>/dev/null | jq 'length'

KNOWN ISSUES
       Help flags don't work on subcommands
       - `r4 channel view --help` errors instead of showing help
       - Only shows error: "Missing required argument: slug"
       - Same issue with all subcommands (track view, channel download, etc.)
       - Framework validates required args before checking for help flags

       Stderr messages appear after JSON output
       - "API unavailable, using bundled v1 data" prints to stderr
       - While technically correct (data to stdout, logs to stderr), it looks mixed
       - Workaround: suppress with `2>/dev/null` or use `--quiet` flag (if added)
       - Current behavior is actually Unix-correct but could be improved with --quiet

       Download command has mixed output formats
       - Progress info, summary, and JSON all in one output
       - Makes it harder to parse just the JSON result programmatically
       - Consider --json-only flag or separate verbose mode

RESOLVED ISSUES
       ✓ Piping to jq now works correctly
       - Previous issue "Unfinished JSON term at EOF" is not reproducible
       - Tested: `r4 channel list --limit 5 | jq '.[0].slug'` works
       - Tested: `r4 channel list --limit 100 | jq 'length'` works
       - Tested complex filters: `r4 channel list --limit 5 | jq '.[] | select(.track_count > 100)'` works
       - JSON output is properly formatted and complete

BACKLOG
       High Priority:
       - Fix --help/-h flag on subcommands (check for help before validating args)
       - Add --quiet/-q flag to suppress stderr informational messages
       - Improve download command output (--json-only flag to output only JSON)

       Medium Priority:
       - Make --limit optional (default: all or sensible default like 100)
       - Add --offset <n>, --sort <field> flags for pagination
       - Add --filter <expr> for inline filtering (e.g., 'track_count > 1000')
       - Add --output/-o <file> flag to save directly to file
       - Add --format flag: json (default), csv, table, tsv (extends --sql)
       - Add --pretty/--compact flags for JSON formatting control
       - Consider adding `channels` as alias for `channel list`
       - Add progress indicators for long operations (downloads, bulk ops)

       Search operations (or use: r4 track list --sql | rg <pattern>)
       - r4 track search <query>
       - r4 channel search <query>

       Nice to Have:
       - Color output option for better readability (--color auto|always|never)
       - Interactive mode for browsing (TUI interface)
       - Bulk operations improvements (better batch handling)
       - Stats/summary commands (r4 channel stats, r4 track stats)
       - Export to additional formats: markdown, yaml, xml
       - Validation mode (check for broken URLs, missing metadata)

       Desired workflow examples to support:
       - r4 channel list --limit 10 --sort track_count --format csv
       - r4 channel list --filter 'track_count > 1000' --output top-channels.json
       - r4 track list --channel acapulco --format table | less
       - r4 channel list --quiet | jq '.[] | select(.track_count > 1000)'

       Download improvements:
       - Add concurrency control (p-limit) for batch downloads
       - Add retry logic for failed downloads
       - Add premium/poToken support for YouTube Music

EXAMPLES
       # Basic viewing (uses v2 API with v1 fallback)
       r4 channel list --limit 10
       r4 channel list --limit 100
       r4 channel view ko002 oskar

       # Piping and filtering with jq
       r4 channel list --limit 100 | jq '.[] | select(.track_count > 500)'
       r4 channel list --limit 100 | jq 'length'
       r4 channel view ko002 oskar | jq '.[].name'

       # Suppress stderr in scripts
       r4 channel list --limit 100 2>/dev/null | jq '.[0].slug'

       # List tracks by channel
       r4 track list --channel ko002
       r4 track list --channel foo --channel bar
       r4 track list --channel acapulco | jq '.[] | .title'

       # Export to SQLite
       r4 channel view ko002 oskar --sql | sqlite3 my.db
       r4 track list --channel ko002 --sql | sqlite3 my.db

       # Export everything
       r4 channel list --limit 4000 --sql | sqlite3 channels.db
       (r4 channel list --limit 1000 --sql; \
        r4 track list --channel foo --sql) | sqlite3 full.db

       # Download tracks
       r4 channel download ko002
       r4 channel download oskar --output ~/Music --dry-run

       # Authentication
       r4 auth login
       export R4_AUTH_TOKEN="your-token-here"
       r4 auth whoami

       # Create and update (requires auth)
       r4 channel create mysounds --name "My Sounds"
       r4 track create --url "..." --title "Song" --channel mysounds
       echo '{"title":"Song","url":"..."}' | r4 track create --channel mysounds

SEE ALSO
       radio4000.com

R4 1.0                    2025-10-28                       R4(1)
