# CLI

Wraps the `r5` lib to query Radio4000 data.

```bash
bun src/lib/cli.ts --help
```

## Data sources

The CLI uses its own, local PGLite database separate from the web app.

The `list` commands require `--source`:

- `local` - your local database exclusive to the cli (not shared with the webapp!)
- `r4` - remote radio4000 API
- `v1` - legacy radio4000 v1 API (read-only)

Pull syncs data from r4 or v1 into local database.

## Core examples

```bash
# List with explicit source
bun cli channels list ko002 --source r4 --json
bun cli tracks list ko002 --source local --limit 5

# Smart sync (checks local first, then r4, then v1)
bun cli pull ko002

# Search local database
bun cli search "acid" --tracks
bun cli search "@detecteve acid"  # within channel
```

## JSON & jq piping

Use `--json` for structured output, pipe to `jq` for processing:

```bash
# Extract specific fields
bun cli tracks list ko002 --source r4 --json | jq '.[].url'
bun cli channels list --source local --json | jq -r '.[].slug'

# Filter results
bun cli tracks list ko002 --json | jq '.[] | select(.url | contains("youtube"))'
bun cli channels list --json | jq '.[] | select(.description | length > 100)'

# Transform data
bun cli tracks list ko002 --json | jq '.[] | {title, url}'

# Chain with unix tools
bun cli tracks list ko002 --json | jq -r '.[].url' | grep youtube | wc -l
```

## HELP!

Some times the local PostgreSQL db gets corrupt. Just delete it with `rm -rf ./cli-db` and run the CLI again.
