# NAME

r4 - Radio4000 command-line interface

# SYNOPSIS

```
r4 <command> [<subcommand>] [<args>] [options]
r4 help
```

# DESCRIPTION

r4 is a command-line interface for interacting with Radio4000 channels and tracks.
It provides tools to browse, create, update, and download radio channels and their tracks.

# COMMANDS

## auth - Authentication

### auth login
Authenticate with Radio4000 using email OTP

**Usage:** `r4 auth login [--email <email>]`

**Options:**
- `--email` - Email address for authentication

**Examples:**
```bash
r4 auth login                              # Interactive prompt
r4 auth login --email "you@example.com"    # Skip email prompt
```

### auth logout
Sign out from Radio4000

**Usage:** `r4 auth logout`

### auth whoami
Show current authenticated user

**Usage:** `r4 auth whoami`

## channel - Channel Operations

### channel list
List channels (from Radio4000 db including v1 data)

**Usage:** `r4 channel list [options]`

**Options:**
- `--limit <n>` - Limit number of results (default: 100)
- `--format <type>` - Output format: text, json, or sql (default: json)

**Examples:**
```bash
r4 channel list                   # All channels, JSON output
r4 channel list --limit 10        # First ten only
r4 channel list --format text     # Human-readable
r4 channel list --format sql      # SQL INSERT statements
```

### channel view
View detailed information about one or more channels

**Usage:** `r4 channel view <slug>... [options]`

**Arguments:**
- `slug` - Channel slug(s) to view (accepts multiple values)

**Options:**
- `--format <type>` - Output format: text, json, or sql (default: json)

**Examples:**
```bash
r4 channel view ko002              # Single channel
r4 channel view ko002 oskar        # Multiple channels
r4 channel view ko002 --format text  # Human-readable
```

### channel create
Create a new channel

**Usage:** `r4 channel create <slug> [options]`

**Arguments:**
- `slug` - Channel slug (e.g., my-sounds)

**Options:**
- `--name <name>` - Channel name
- `--description <text>` - Channel description
- `--image <url>` - Channel image URL
- `--sql` - Output as SQL statements

**Examples:**
```bash
r4 channel create mysounds --name "My Sounds"
r4 channel create mysounds --name "My Sounds" --description "A collection of sounds"
```

### channel update
Update one or more channels

**Usage:** `r4 channel update <slug>... [options]`

### channel delete
Delete one or more channels

**Usage:** `r4 channel delete <slug>...`

## track - Track Operations

### track list
List tracks for specified channel(s), optionally filtered by tags

**Usage:** `r4 track list [options]`

**Options:**
- `--channel <slug>` - Channel slug to filter by (can be used multiple times)
- `--tag <value>` - Filter by tag (supports `--tag a --tag b` or `--tag a,b,c`)
- `--match-all` - When using multiple tags, require all tags to match (AND logic)
- `--limit <n>` - Limit number of results
- `--format <type>` - Output format: text, json, or sql (default: text)

**Examples:**
```bash
r4 track list --channel ko002                                    # All tracks from one channel
r4 track list --channel ko002 --limit 20                         # First 20 only
r4 track list --channel ko002 --channel oskar                    # Multiple channels
r4 track list --channel ko002 --tag jazz                         # Filter by single tag
r4 track list --channel ko002 --tag jazz --tag ambient           # Multiple tags (OR logic)
r4 track list --channel ko002 --tag jazz,ambient,drone           # Comma-separated tags
r4 track list --channel ko002 --tag house --tag techno --match-all  # Require all tags (AND logic)
r4 track list --channel ko002 --format sql                       # SQL INSERT statements
```

### track view
View detailed information about one or more tracks

**Usage:** `r4 track view <id>... [options]`

**Arguments:**
- `id` - Track ID(s) to view (accepts multiple values)

**Options:**
- `--format <type>` - Output format: text, json, or sql (default: json)

**Examples:**
```bash
r4 track view abc123              # Single track
r4 track view abc123 def456       # Multiple tracks
r4 track view abc123 --format text  # Human-readable
```

### track create
Create a new track

**Usage:** `r4 track create [options]`

**Options:**
- `--channel <slug>` - Channel slug
- `--title <text>` - Track title
- `--url <url>` - Track URL
- `--sql` - Output as SQL statements

**Examples:**
```bash
r4 track create --channel mysounds --title "Song Name" --url "https://youtube.com/..."
echo '{"title":"Song","url":"..."}' | r4 track create --channel mysounds  # Via stdin
```

### track update
Update one or more tracks

**Usage:** `r4 track update <id>... [options]`

### track delete
Delete one or more tracks

**Usage:** `r4 track delete <id>...`

## tags - Tag Operations

### tags list
List all tags from a channel with optional sorting and filtering

**Usage:** `r4 tags list <slug> [options]`

**Arguments:**
- `slug` - Channel slug to list tags from

**Options:**
- `--sorted` - Sort by occurrence count (most used first)
- `--limit <n>` - Limit number of tags to show
- `--min-count <n>` - Only show tags used at least this many times (default: 1)
- `--format <type>` - Output format: text, json, or counts

**Examples:**
```bash
r4 tags list ko002                      # All tags alphabetically
r4 tags list ko002 --sorted             # By popularity
r4 tags list ko002 --sorted --limit 10  # Top 10 tags
r4 tags list ko002 --min-count 5        # Tags used 5+ times
r4 tags list ko002 --format json        # JSON output
r4 tags list ko002 --format counts      # With counts
```

### tags generate
Generate tag-based folder structure with symlinks to downloaded tracks

**Usage:** `r4 tags generate <slug> [options]`

**Arguments:**
- `slug` - Channel slug to generate tags for

**Options:**
- `--output <path>` - Base folder path (defaults to `./<slug>`)
- `--clean` - Remove existing tags folder before generating (default: true)
- `--dry-run` - Show what would be created without creating it
- `--verbose` - Show detailed output

**Examples:**
```bash
r4 tags generate ko002                     # Generate tags after downloading
r4 tags generate ko002 --output ./my-music # Custom location
r4 tags generate ko002 --dry-run           # Preview without creating
r4 tags generate ko002 --verbose           # Show all symlinks created
```

**Note:** Run `r4 download <slug>` first to download the tracks before generating tag folders.

## download - Download Tracks

Download all tracks from a channel

**Usage:** `r4 download <slug> [options]`

**Arguments:**
- `slug` - Channel slug to download

**Options:**
- `--output <path>` - Download folder path (defaults to ./downloads/<slug>)
- `--limit <n>` - Limit number of tracks to download
- `--force` - Re-download existing files
- `--dryRun` - Show what would be downloaded without downloading
- `--debug` - Show detailed debug output
- `--noMetadata` - Skip writing metadata to files

**Examples:**
```bash
r4 download ko002                         # Download to ./downloads/ko002
r4 download ko002 --limit 10              # First 10 tracks only
r4 download ko002 --output ./my-music     # Custom location
r4 download ko002 --dry-run               # Preview without downloading
r4 download ko002 --force                 # Re-download existing files
```

## db - Database Operations

### db schema

Output SQL CREATE TABLE statements for channels and tracks

**Usage:** `r4 db schema [options]`

**Options:**
- `--channels` - Output only channels schema
- `--tracks` - Output only tracks schema

**Examples:**
```bash
r4 db schema                      # Both tables
r4 db schema --channels           # Channels only
r4 db schema --tracks             # Tracks only
r4 db schema | sqlite3 my.db      # Create database
```

## search - Search

Search channels and tracks

**Usage:** `r4 search <query> [options]`

**Arguments:**
- `query` - Search query

**Options:**
- `--channels` - Search only channels
- `--tracks` - Search only tracks
- `--limit <n>` - Limit number of results per category (default: 10)
- `--json` - Output as JSON

**Examples:**
```bash
r4 search ambient                          # Search both channels and tracks
r4 search ambient --channels               # Channels only
r4 search "electronic music" --tracks      # Tracks only
r4 search ambient --limit 5                # Limit results per category
r4 search ambient --json                   # JSON output
```

# DATA SOURCES

Read operations (list/view) use smart fallback:
1. Query v2 API (Supabase)
2. Fall back to bundled v1 data (read-only, ~600 channels)

Write operations (create/update/delete) require authentication and work with v2 API only.

# AUTHENTICATION

Two ways to authenticate:
1. Set `R4_AUTH_TOKEN` environment variable
2. Use interactive login: `r4 auth login`

Authentication is required for write operations (create, update, delete).

# OUTPUT FORMATS

All list and view commands support multiple output formats via the `--format` option:
- **json** - Structured JSON data (default)
- **sql** - SQL INSERT statements for SQLite/PostgreSQL
- **text** - Human-readable formatted output (where applicable)

Use `--format json`, `--format sql`, or `--format text` depending on your needs.

# PIPING AND COMPOSITION

r4 outputs JSON by default, making it easy to pipe to other tools:

```bash
# Extract specific fields with jq
r4 channel list --limit 10 | jq '.[].slug'
r4 track list --channel ko002 | jq '.[] | .title'

# Export to SQLite database (two commands, done)
r4 db schema | sqlite3 my.db
r4 track list --channel ko002 --format sql | sqlite3 my.db

# Add more channels to the same database
r4 track list --channel oskar --format sql | sqlite3 my.db
r4 channel list --limit 1000 --format sql | sqlite3 my.db

# Pipe JSON input to create command
echo '{"title":"Song","url":"..."}' | r4 track create --channel mysounds

# Convert between formats
r4 channel view ko002 --format json | jq '.name'
r4 channel view ko002 --format text
```

# INSTALLATION

For downloads to work, make sure `youtube-dl` (https://github.com/rg3/youtube-dl/) and `ffmpeg` are installed on your system.

## From npm

```bash
npm i -g r4
```

## From repo directly

```bash
npm i -g github:radio4000/r4
```

# DEVELOPMENT

```bash
git clone git@github.com:radio4000/r4.git
cd r4
npm link
```

Linking makes `r4` use your local copy. If you are changing the path or adding a new binary, remember to run `npm unlink` and `npm link` in the project.

Run tests with `bun test` or `npm test`.
Check code formatting with `bun run check`.

# ADVANCED USAGE

If you have `jq` installed, you can download the tracks of a channel with this one-liner:

```bash
curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | jq -r '.[] | .url' | youtube-dl -ixa /dev/stdin --audio-format mp3
```

If you don't have `jq`, but have `python`, try this:

```bash
curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | python -m json.tool | grep -oP '"url": "\K(.+)",' | youtube-dl -a /dev/stdin --extract-audio --audio-format mp3
```

# SEE ALSO

- https://radio4000.com
- https://github.com/radio4000/r4
