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
r4 channel list --sort created --limit 5           # Newest channels
r4 channel view ko002
r4 track list --channel ko002
r4 track list --channel ko002 --tag jazz,ambient
r4 download ko002                                     # downloads to ./ko002/
r4 download ko002 --base-url https://cdn.example.com  # absolute URLs in download.json
r4 download ko002 --backup-file                       # only write download.json, no download
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

After downloading, a `download.json` is written alongside the tracks — a self-contained `ChannelBackup` (`{ version, created_at, channel, tracks[] }`) where each track's `url` points to its local file at `tracks/<filename>.<ext>`. Tracks that failed to download keep their original remote URL. Use `--base-url` to produce absolute URLs (e.g. when serving the folder over HTTP). Use `--no-metadata` to skip writing `download.json`.

### YouTube Premium (256kbps)

By default YouTube serves ~128kbps audio. With a Premium account, some videos also have 256kbps AAC. To get it, pass your browser's cookies and install the [bgutil PO token plugin](https://github.com/Brainicism/bgutil-ytdlp-pot-provider) for yt-dlp. Without the plugin, downloads fall back to ~128kbps with a warning.

```bash
r4 download ko002 --cookies-from-browser chrome            # new tracks in 256kbps where available
r4 download ko002 --cookies-from-browser chrome --upgrade  # also replace existing ~128kbps tracks
```

`--upgrade` reads bitrates with `ffprobe` (part of ffmpeg) and only replaces a file once the better version has downloaded, so if a video is gone or has nothing better, your file stays. Add `--dry-run` to see how many it would try.

## Development

```bash
git clone git@github.com:radio4000/cli.git
cd r4
bun install
bun link # optional for easy local dev
bun run check # format and lint
bun run test
```
