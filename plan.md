# R4 Improvement Plan

Ideas and tasks for later.

## Feature Ideas

- Maintain a local cache of fetched tracks somehow to avoid fetching all tracks tons of times
- Add premium/poToken support for YouTube Music. e.g. if you have a premium account you can dl the tracks via that which gives you 256kb

## Data Issues

### Malformed JSON in track data
**Issue:** `r4 track list --channel acapulco` (without --limit) produces invalid JSON with unterminated string at position 65495 (line 1837 column 13)
**Impact:** Cannot pipe full track list to jq or other JSON processors
**Workaround:** Use `--limit` flag to avoid the malformed data
**TODO:** Investigate which track has malformed data and either fix at source or add validation/sanitization in the CLI

## CLI Issues (based on testing + comparison with `bun` CLI)

### Design Inspirations from Bun

#### Command presentation (very nice!)
- Two-column layout: `command   description   example`
  ```
  run       ./my-script.ts       Execute a file with Bun
            lint                 Run a package.json script
  ```
- Shows concrete examples in third column (genius!)
- Groups related commands visually (spacing)

#### What we could adopt:
1. **Add example column** to our help output
   - `channel list   acapulco              List all channels`
   - `track list     --channel acapulco    List tracks in channel`

2. **Command aliases** mentioned inline
   - `install   (bun i)`
   - `add       (bun a)`
   - We could show: `channel list (r4 ch ls)` if we add aliases

3. **Better grouping** - Bun groups by workflow:
   - "Run stuff" commands first
   - "Package management" commands together
   - "Project creation" commands together

   We group by resource (channel/track), which is fine, but consider workflow ordering

4. **Bottom-of-help contextual info**
   - `bun run` shows: "package.json scripts (3 found):" with actual scripts
   - We could show: "Connected to: v2 API" or "Using bundled v1 data"
   - Or: "Auth: logged in as user@example.com" vs "Auth: not logged in"

5. **Hint about subcommand help**
   - `<command> --help    Print help text for command`
   - Very clear signposting!

#### Flags section clarity
Bun shows:
- Short form: `-h, --help`
- Value format: `--config=<val>`
- Description inline

Our current help shows flags but not consistently across commands.

### Improvements to Consider

#### Per-command help: Missing flags documentation
**Current state:**
- ✅ Usage line shown (`r4 channel list [options]`)
- ✅ Description shown
- ✅ Examples shown
- ❌ Available flags/options not documented

**Issue:** `r4 channel list --help` doesn't show that `--limit` and `--format` flags exist. Users have to guess or read the code.

**Design challenge:**
- Option A: Manually add `options: [{name: '--limit', description: '...'}, ...]` to each command's metadata
- Option B: Auto-generate from `parse()` options (would need description field added to parse config)
- Option C: Create a helper function that commands can use to document their flags

**Example of what help should show:**
```
Usage: r4 channel list [options]

List all channels (from v2 API or bundled v1 data)

Options:
  --limit <n>       Limit number of results (default: 100)
  --format <type>   Output format: text, json, sql (auto: tty=text, pipe=json)

Examples:
  r4 channel list
  r4 channel list --limit 10
```

#### Error message quality: Add "Did you mean?" suggestions
**Current:** `r4 channal` → "Unknown command: channal"
**Better:** Show fuzzy-matched suggestions for typos

**Implementation ideas:**
- Use Levenshtein distance or similar algorithm
- Only suggest if distance is small (1-2 edits)
- Example: "Unknown command: channal. Did you mean 'channel'?"

**clig.dev guidance:** "If the user did something wrong and you can guess what they meant, suggest it."

### Nice to Have

#### Shell completions
Generate completion scripts for bash/zsh/fish
- Low priority but would improve UX

### Testing Checklist

Core functionality:
- [x] `r4` → shows help
- [x] `r4 -h` → shows help
- [x] `r4 --help` → shows help
- [x] `r4 help` → shows help
- [x] `r4 version` → shows version
- [x] `r4 channel` → shows channel subcommands
- [x] `r4 channel list --help` → shows channel list help
- [x] `r4 channel list -h` → shows channel list help

TTY detection:
- [x] `r4 channel list` (TTY) → human readable text
- [x] `r4 channel list | cat` (not TTY) → JSON
- [x] `r4 track list --channel acapulco --limit 5 | jq` → works

Exit codes & stderr:
- [x] Exit code 0 on success ✅
- [x] Exit code non-zero on failure ✅
- [x] Errors go to stderr: `r4 bad 2>/dev/null` hides error ✅

### Exit codes and stderr (from clig.dev)
✅ **Verified working correctly:**
- Exit codes: 0 on success, 1 on failure
- Errors go to stderr (can be redirected with `2>/dev/null`)
- Data goes to stdout (clean for piping)

### Standard flags to consider (from clig.dev)
- `--quiet` / `-q` - Suppress non-essential output
- `--debug` / `-d` - Show debug information
- `--dry-run` / `-n` - For delete commands, show what would happen without doing it

### Future ideas
- Progress spinners (only when TTY) for long operations
- stdin support (`-` flag) for piping data in
- Config file at `~/.config/r4/config.json` (follow XDG spec)
- Dangerous operation prompts (delete commands should confirm)

## CLI Framework Improvements

Ideas for the framework itself:
- Add mutually exclusive options support (e.g., `exclusive: ['channels', 'tracks']`)
- TTY-aware formatters: composable middleware (text vs json vs table)
