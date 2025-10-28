# NAME

r4 - Radio4000 command-line interface

# SYNOPSIS

```
r4 <command> [<subcommand>] [<args>] [options]
r4 help
r4 version
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
r4 auth login
r4 auth login --email "you@example.com"
```

### auth logout
Sign out from Radio4000

**Usage:** `r4 auth logout`

### auth whoami
Show current authenticated user

**Usage:** `r4 auth whoami`

## channel - Channel Operations

### channel list
List all channels (from v2 API or bundled v1 data)

**Usage:** `r4 channel list [options]`

**Options:**
- `--limit <n>` - Limit number of results (default: 100)
- `--format <type>` - Output format: text, json, or sql (default: json)

**Examples:**
```bash
r4 channel list
r4 channel list --limit 10
r4 channel list --limit 100 --format sql
r4 channel list --format json
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
r4 channel view ko002
r4 channel view ko002 oskar
r4 channel view ko002 --format sql
r4 channel view ko002 --format json
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
r4 channel create mysounds --name "My Sounds" --description "A collection"
```

### channel update
Update one or more channels

**Usage:** `r4 channel update <slug>... [options]`

### channel delete
Delete one or more channels

**Usage:** `r4 channel delete <slug>...`

## track - Track Operations

### track list
List tracks for specified channel(s)

**Usage:** `r4 track list [options]`

**Options:**
- `--channel <slug>` - Channel slug to filter by (can be used multiple times)
- `--limit <n>` - Limit number of results
- `--format <type>` - Output format: text, json, or sql (default: text)

**Examples:**
```bash
r4 track list --channel ko002
r4 track list --channel ko002 --limit 20
r4 track list --channel ko002 --format json
r4 track list --channel ko002 --format sql
r4 track list --channel ko002 --channel oskar
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
r4 track view abc123
r4 track view abc123 def456
r4 track view abc123 --format sql
r4 track view abc123 --format json
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
echo '{"title":"Song","url":"..."}' | r4 track create --channel mysounds
```

### track update
Update one or more tracks

**Usage:** `r4 track update <id>... [options]`

### track delete
Delete one or more tracks

**Usage:** `r4 track delete <id>...`

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
r4 download ko002
r4 download ko002 --limit 10
r4 download ko002 --output ./my-music
r4 download ko002 --dry-run
r4 download ko002 --force
r4 download ko002 --no-metadata
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
r4 search ambient
r4 search ambient --channels
r4 search ko002 --channels --limit 5
r4 search "electronic music" --tracks
r4 search ambient --json
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
r4 track list --channel foo --format json | jq '.[] | .title'
r4 channel list --limit 10 | jq '.[].slug'

# Export to SQLite database
r4 channel list --limit 1000 --format sql | sqlite3 channels.db
r4 track list --channel mysounds --format sql | sqlite3 tracks.db

# Pipe JSON input to create command
echo '{"title":"Song","url":"..."}' | r4 track create --channel mysounds

# Convert between formats
r4 channel view ko002 --format json | jq '.name'
r4 channel view ko002 --format text  # human-readable output
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
