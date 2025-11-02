# R4 Improvement Plan

Ideas and tasks for later.

## Feature Ideas

- Maintain a local cache of fetched tracks somehow to avoid fetching all tracks tons of times
- Add premium/poToken support for YouTube Music. e.g. if you have a premium account you can dl the tracks via that which gives you 256kb

## CLI Issues (based on testing + comparison with `bun` CLI)

### Critical Issues (should fix)

#### 1. No-args behavior
**Current:** `r4` → Error: "No command specified"
**Expected:** Show help (like bun, git, docker, npm)
**Fix:** In cli/utils.js route(), if commandPath is empty, return help.js

#### 2. Global --help flag not working
**Current:** `r4 --help` → Error: "No command specified"
**Expected:** Show help
**Issue:** Flags are skipped during routing (utils.js:18-20)
**Fix:** Handle --help and -h in main.js before routing

#### 3. Global --version flag not working
**Current:** `r4 --version` → Error: "No command specified"
**Expected:** Show version (also try -v)
**Fix:** Handle --version/-v in main.js before routing

#### 4. Subcommand --help ignored
**Current:** `r4 channel list --help` → Executes command normally
**Expected:** Show help for that specific command
**Compare:** `bun run --help` shows detailed help for 'run' command
**Fix:** Each command should check for --help in argv and return usage text

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

### Medium Priority

#### 5. Intermediate command help
**Current:** `r4 channel` → Error: "'channel' requires a subcommand"
**Better:** Show available subcommands for 'channel'
**Compare:** Many CLIs show available subcommands in this case
**Example output:**
```
Available channel commands:
  r4 channel list      List all channels
  r4 channel view      View channel details
  r4 channel create    Create a new channel
  r4 channel update    Update channels
  r4 channel delete    Delete channels

Use 'r4 channel <command> --help' for more information
```

#### 6. Consistent output formats
**Current:** `r4 track list --channel acapulco` outputs formatted text, not JSON
**Issue:** Examples show piping to jq, but default output isn't JSON
**Consider:**
- Make JSON the default for list commands (machine-readable)
- Add --format flag: json (default), table, compact
- Or add --human flag for pretty output

#### 7. Per-command help text
Each command should export a `help` property with:
- Usage: `r4 channel list [options]`
- Description: What it does
- Options: Available flags
- Examples: 2-3 concrete examples

#### 8. Error message quality
**Current errors:**
- "No command specified" (generic)
- "Unknown command: X" (okay)
- "'channel' requires a subcommand" (okay but could be better)

**Better errors:**
- Show "Did you mean?" suggestions
- Show available commands in context
- Provide fix hint: "Try 'r4 help' to see all commands"

### Nice to Have

#### 9. Aliases
- `r4 ch` → `r4 channel`
- `r4 tr` → `r4 track`
- `r4 ls` → `r4 channel list`
- Show in help: `channel (ch)`

#### 10. Shell completions
Generate completion scripts for bash/zsh/fish

#### 11. Color and formatting
- Use colors for better readability (errors in red, success in green)
- Bold for command names
- Dim for less important info
- (Keep optional with --no-color flag)

#### 12. Interactive mode
If no args: could offer interactive prompt instead of just help
- Select command from list
- Step through options
- Show examples

### Testing Checklist

After fixes, these should all work:
- [ ] `r4` → shows help
- [ ] `r4 -h` → shows help
- [ ] `r4 --help` → shows help
- [ ] `r4 -v` → shows version
- [ ] `r4 --version` → shows version
- [ ] `r4 help` → shows help
- [ ] `r4 version` → shows version
- [ ] `r4 channel` → shows channel subcommands (not error)
- [ ] `r4 channel --help` → shows channel subcommands
- [ ] `r4 channel list --help` → shows channel list help
- [ ] `r4 channel list -h` → shows channel list help
- [ ] All examples in help text actually work
- [ ] Piping works: `r4 channel list | jq`

### Implementation Priority

1. Fix critical issues (1-4): Make standard CLI conventions work
2. Improve help output: Add examples column, better grouping
3. Add per-command help: Make --help work on every command
4. Better errors: Show suggestions, hints
5. Nice to have: Aliases, colors, completions

### Philosophy Questions

- **Man page style vs modern style?** → Use modern (Usage, Commands, Examples). clig.dev confirms this.
- **Verbose by default or quiet?** → Check TTY: if piped, just data. If interactive, add confirmations.
- **Strict POSIX or flexible?** → Keep flexible (parseArgs supports both)

## Missing from clig.dev review

### Add to Critical Issues:
- **Exit codes**: 0 on success, non-zero on failure
- **stderr vs stdout**: errors/logs → stderr, data → stdout
- **TTY detection**: `process.stdout.isTTY` - critical for output format decision

### Add to Testing Checklist:
- [ ] `r4 channel list` (TTY) → human readable
- [ ] `r4 channel list | cat` (not TTY) → JSON
- [ ] Exit code 0 on success
- [ ] Errors go to stderr: `r4 bad 2>/dev/null`

### Standard flags (add where relevant):
- `--no-color` + respect `NO_COLOR` env var
- `--quiet` / `-q`
- `--debug` / `-d`
- `--dry-run` / `-n` (for delete commands)

### Add Later:
- Progress spinners (only when TTY)
- stdin support (`-` flag)
- Config file at `~/.config/r4/config.json`
- Environment variables: `R4_API_URL`, `R4_FORMAT`, `NO_COLOR`
- Dangerous operation prompts (delete commands)

## CLI Framework Improvements

- Add mutually exclusive options support (e.g., `exclusive: ['channels', 'tracks']`)
- Auto-JSON formatting: if command returns object + `--json` flag present, auto-stringify at framework level
- TTY-aware formatters: composable middleware (text vs json vs table)
