# R4 CLI (New Framework-Based)

A new CLI implementation using the custom CLI framework.

## Commands Implemented

### channel list
List all downloaded channels in the current directory.

**Usage:**
```bash
node cli/index.js channel list
node cli/index.js channel list --sql
```

**Output:** Lists all directories that contain a matching `.json` file (e.g., `test-channel/test-channel.json`).

### channel view <slug>
View detailed information about a specific channel.

**Usage:**
```bash
node cli/index.js channel view test-channel
node cli/index.js channel view test-channel --sql
node cli/index.js channel view test-channel --tracks-only
```

**Options:**
- `--sql`: Output as SQL INSERT statements
- `--tracks-only`: Show only track information (excludes channel metadata)

## Testing

A test channel has been created at `test-channel/test-channel.json` for testing purposes.

**Examples:**
```bash
# List channels (JSON output)
node cli/index.js channel list

# View a channel
node cli/index.js channel view test-channel

# View only tracks
node cli/index.js channel view test-channel --tracks-only

# SQL output
node cli/index.js channel list --sql
```

## Implementation Notes

- Commands are in `cli/commands/channel/*.js`
- Each command exports a plain object with `description`, `args`, `options`, and `handler`
- The framework handles routing, parsing, validation, and output formatting
- Error handling is built-in with structured error messages

## Next Steps

Potential commands to implement:
- `channel create <slug>` - Create a new channel
- `channel delete <slug>` - Delete a channel
- `track list <channel>` - List tracks in a channel
- `track add <channel> <url>` - Add a track to a channel
- `track remove <channel> <id>` - Remove a track from a channel
