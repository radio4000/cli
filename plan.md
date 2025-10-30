In this file we can save ideas and tasks for later.

- Maintain a local cache of fetched tracks somehow to avoid fetching all tracks tons of times
- Add premium/poToken support for YouTube Music. e.g. if you have a premium account you can dl the tracks via that which gives you 256kb

## CLI Framework improvements

- Add mutually exclusive options support (e.g., `exclusive: ['channels', 'tracks']`) - would clean up manual validation
- Auto-JSON formatting: if command returns object + `--json` flag present, auto-stringify at framework level
- Consider: output formatters as composable middleware (text vs json vs table)
