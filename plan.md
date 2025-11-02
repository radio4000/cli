# R4 Improvement Plan

Ideas and tasks for later.

---- READY TO PICK UP -----

--- IDEAS TO EVALUATE ---

- Maintain a local cache of fetched tracks somehow to avoid fetching all tracks tons of times
- Add premium/poToken support for YouTube Music. e.g. if you have a premium account you can dl the tracks via that which gives you 256kb
- Progress spinners (only when TTY) for long operations
- stdin support (`-` flag) for piping data in
- Config file at `~/.config/r4/config.json` (follow XDG spec)
- Dangerous operation prompts (delete commands should confirm)
- Add mutually exclusive options support (e.g., `exclusive: ['channels', 'tracks']`)
- TTY-aware formatters: composable middleware (text vs json vs table)
- Generate completion scripts for bash/zsh/fish for DX

