# r4

Command-line interface for [Radio4000](https://radio4000.com)
- browse, create, update, and download radio channels and tracks.

```bash
npm i -g r4
r4 help
```

> For the `r4 download` command to work, make sure [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) is installed on your system.

> For Soulseek downloads, you need [`slskd`](https://github.com/slskd/slskd) running.

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

Most commands support a `--format` flag to print human-readable text, json or SQL.

## Downloading

Download tracks from YouTube (default) or Soulseek for higher quality audio.

### YouTube (default)

```bash
r4 download ko002
r4 download ko002 --limit 10
r4 download ko002 --dry-run  # preview without downloading
```

Requires [`yt-dlp`](https://github.com/yt-dlp/yt-dlp).

### Soulseek

Download lossless (FLAC, WAV) or high-bitrate (320kbps) audio from Soulseek.

Requires [slskd](https://github.com/slskd/slskd) and a [Soulseek account](https://www.slsknet.org/).

```bash
# 1. Start slskd with your Soulseek credentials
docker run -d --name slskd \
  --network host \
  -e SLSKD_SLSK_USERNAME=your_soulseek_username \
  -e SLSKD_SLSK_PASSWORD=your_soulseek_password \
  -v ~/slskd-downloads:/app/downloads \
  slskd/slskd

# 2. Verify slskd is connected (check web UI at http://localhost:5030)
# Default web UI login: slskd / slskd

# 3. Download via Soulseek
r4 download ko002 --source soulseek
r4 download ko002 --source soulseek --limit 10 --verbose
r4 download ko002 --source soulseek --min-bitrate 256
```

**Troubleshooting:**
- If slskd can't connect to Soulseek servers, check `docker logs slskd`
- Ensure ports 2271/2242 aren't blocked by firewall: `nc -zv vps.slsknet.org 2271`
- Some VPNs/ISPs block Soulseek - try without VPN
- The download is idempotent - run again to retry failed tracks

> For the `r4 download` command to work, make sure [`yt-dlp`](https://github.com/yt-dlp/yt-dlp) is installed.

## Development

```bash
git clone git@github.com:radio4000/cli.git
cd r4
bun install
bun link # optional for easy local dev
bun run check # format and lint
bun run test
```
