# r4

Command-line interface for [Radio4000](https://radio4000.com)
- browse, create, update, and download radio channels and tracks.

```bash
npm i -g r4
r4 help
```

Here's a quick overview:

```bash
r4 channel list --limit 10
r4 channel view ko002
r4 track list --channel ko002
r4 track list --channel ko002 --tag jazz,ambient
r4 download ko002
r4 search "ambient"
r4 auth login
r4 channel create radio123 --name "Radio 123"
r4 track create --channel radio123 --title "Song" --url "https://youtube.com/..."
r4 track update <id> --title "Updated song"

# Pipe and compose
r4 track list --channel ko002 --limit 10 | jq '.[] | .title'

# Or export to sqlite
r4 schema | sqlite3 my.db
r4 track list --channel ko002 --format sql | sqlite3 my.db
```

Most commands support a  `--format` flag to print human-readable text, json or SQL.

> For the `r4 download` command to work, make sure [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) is installed.

## Development

```bash
git clone git@github.com:radio4000/r4.git
cd r4
bun install
bun link # optional for easy local dev
bun run check # format and lint
bun run test
```
