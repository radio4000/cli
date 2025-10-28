# CLI Framework Plan

## Overview
A lightweight framework for building command-line interfaces with a file-per-subcommand architecture. Designed to support hierarchical commands (noun-verb patterns) with rich argument parsing and multiple output formats.

**Inspiration from:**
- **Clap.rs** - Declarative arg definitions, conflicts, validation, help generation
- **npm CLI** - Class-based commands, static metadata, centralized config
- **Our twist** - Plain object exports, zero dependencies, simplicity-first

**What we're building:**
A framework that makes it trivial to create CLIs like `r4 channel view ko002 --sql` where each command is just a file exporting `{ description, args, options, handler }`.

## Design Goals
1. **File-per-subcommand** - Each command lives in its own file for maintainability
2. **Declarative** - Commands describe themselves (args, flags, description)
3. **Zero dependencies** - Uses Node.js built-in `util.parseArgs`
4. **Type-safe** - Leverage Zod for validation
5. **Output flexibility** - Support multiple formats (JSON, SQL, etc.)
6. **Simple routing** - Directory structure maps directly to CLI structure

## Design Philosophy: Objects vs Classes vs Functions

**Typer's approach (Python with decorators):**
```python
@app.command()
def view(slug: str, json: bool = True):
    """View one or more channels in detail"""
    channels = get_channels(slug)
    return channels
```
- Function signature IS the definition (types = validation)
- Docstring = description
- Zero boilerplate, maximum clarity

**npm's class-based approach:**
```js
class ChannelView extends BaseCommand {
  static description = 'View channels'
  static args = [...]
  async exec(args) { }
}
```

**Our choice: Plain object exports**
```js
export default {
  description: 'View channels',
  args: [...],
  handler: async ({ args, flags, context }) => { }
}
```

**Why plain objects over function-based (like Typer)?**
- **JavaScript has no runtime type introspection** - Can't read `slug: string` like Python
- **No decorators yet** - They're stage 3, not stable
- **Explicit > implicit** - Plain objects make the contract visible
- **Metadata colocation** - args, options, examples all in one place

**Why plain objects over classes (like npm)?**
- **Simpler mental model** - No inheritance, no `this`, no `static`
- **JSON-serializable** - Could theoretically load from JSON/YAML
- **Pure functions** - Handler is just `async (input) => output`
- **Less boilerplate** - No class definition, no constructor
- **Better for one-off commands** - Classes shine with shared behavior; our commands are independent

**If JavaScript had Typer-style introspection, we'd use functions. Since it doesn't, plain objects are the next best thing.**

### Alternative: Typer-inspired with JSDoc (Future Experiment)

We *could* get closer to Typer's ergonomics with JSDoc + conventions:

```js
/**
 * View one or more channels in detail
 * @arg {string[]} slug - Channel slug to view
 * @flag {boolean} json=true - Output as JSON
 * @flag {boolean} sql - Output as SQL statements
 */
export default async function view({ slug, json, sql }, context) {
  const channels = await getChannels(slug);
  return channels;
}
```

Then framework parses JSDoc to extract metadata. **Trade-off:**
- ✅ Less boilerplate (no explicit args array)
- ✅ JSDoc is standard, well-supported
- ❌ Custom JSDoc tags (`@arg`, `@flag`) not standard
- ❌ Parsing JSDoc at runtime adds complexity
- ❌ Harder to validate definition shape

**Decision: Keep plain objects for V1. Consider JSDoc approach later if boilerplate becomes painful.**

## Configuration: Centralized vs Per-Command

**npm approach:**
- Centralized config registry (`this.npm.config.get('save-dev')`)
- Commands declare `static params = ['save-dev', 'global']`
- Actual config values come from: CLI flags, `.npmrc`, env vars
- Enables complex precedence: flag > env > user config > global config

**Our approach:**
- Per-command option definitions (in each command file)
- Framework handles `util.parseArgs` directly
- Simpler model: flags are the only config source
- No config files (yet)

**When we'd need centralized config:**
- Multiple commands share same flag (e.g., `--verbose` everywhere)
- Config file support (`.r4rc`)
- Environment variable overrides

**For now:** Keep it simple. If we need global flags, we'll add a framework-level options merge.

## Architecture

### Framework Structure
```
/cli-framework/
  index.js          # Main entry point & router
  runner.js         # Command execution logic using parseArgs
  types.js          # Zod schemas for command definitions
  utils/
    output.js       # Format handlers (json, sql, etc.)
    validation.js   # Input validation helpers
```

### Command Structure
```
/src/commands/      # Actual commands (example: R4)
  channel/
    list.js         # r4 channel list
    view.js         # r4 channel view <slug>
    create.js       # r4 channel create <slug>
  track/
    list.js         # r4 track list
    view.js         # r4 track view <id>
  add.js            # r4 add <url>  (porcelain command)
```

## Command Definition Format

Each command file exports a standard shape:

```js
export default {
  description: "View one or more channels in detail",

  // Declare expected positional arguments
  args: [
    {
      name: 'slug',
      description: 'Channel slug to view',
      required: true,
      multiple: true  // <slug>... accepts multiple
    }
  ],

  // parseArgs configuration (flags only)
  options: {
    json: {
      type: 'boolean',
      default: true,
      description: 'Output as JSON'
    },
    sql: {
      type: 'boolean',
      description: 'Output as SQL statements',
      conflicts: ['json']  // can't use both
    },
    limit: {
      type: 'string',  // parseArgs doesn't have 'number' type
      description: 'Limit number of results',
      parse: (val) => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 1) {
          throw new Error('--limit must be a positive number');
        }
        return num;
      }
    }
  },

  // Optional: validation schema
  validate: z.object({
    slug: z.array(z.string().min(1))
  }),

  // Handler receives parsed & validated input
  handler: async ({ args, flags, context }) => {
    // args = { slug: ['ko002', 'oskar'] }
    // flags = { json: true }
    // context = { auth, config, output }

    const channels = await getChannels(args.slug);
    return channels;
  },

  // Optional: Examples for help generation
  examples: [
    'r4 channel view ko002',
    'r4 channel view ko002 oskar --sql'
  ]
}
```

**Key improvements:**
- `args` array declares positional arguments with validation rules
- `conflicts` in options (like Clap)
- Validation schema (optional but recommended)
- Structured input instead of raw `{ values, positionals }`
- Context object for shared state

## Routing Logic

1. Parse positional arguments to determine command path:
   ```
   r4 channel list --json
   └─┘ └─────┘ └──┘ └────┘
    │     │     │     └─ flags (parseArgs)
    │     │     └─ verb (route to file)
    │     └─ noun (route to directory)
    └─ program name (ignore)
   ```

2. Map to filesystem:
   - `r4 channel list` → `/commands/channel/list.js`
   - `r4 track view` → `/commands/track/view.js`
   - `r4 add` → `/commands/add.js`

3. Load command module and execute handler with parsed args

## Output Handling

Commands return raw data. Framework handles formatting based on flags:
- `--json` (default): `JSON.stringify(data, null, 2)`
- `--sql`: Transform data to SQL INSERT statements
- Custom formatters can be added to `/utils/output.js`

## Error Handling

Framework provides structured error types with helpful messages:

**Error Categories:**
```js
class CLIError extends Error {
  constructor(type, message, context) {
    super(message);
    this.type = type;
    this.context = context;
  }
}

// Usage in framework:
// throw new CLIError('unknown_command', 'Command not found: r4 foo', {
//   available: ['channel', 'track', 'auth']
// })
```

**Error Types:**
- `unknown_command` - Show available commands at this level
- `missing_argument` - Show which arg is required
- `invalid_argument` - Show validation error + expected format
- `conflicting_options` - Show which flags conflict
- `handler_error` - Catch and wrap command errors with context

**Output Format:**
```
Error: Command not found: r4 foo

Available commands:
  r4 channel - Manage channels
  r4 track   - Manage tracks
  r4 auth    - Authentication
  r4 add     - Add track with URL

Run 'r4 --help' for more information.
```

**Handler Errors:**
Commands throw, framework catches and formats:
```js
// In command:
if (!channel) {
  throw new Error(`Channel not found: ${slug}`);
}

// Framework wraps it:
// Error in 'r4 channel view ko002':
// Channel not found: ko002
```

## Testing Strategy

Using **Bun's built-in test runner** (`bun test`):

```js
// cli-framework/runner.test.js
import { test, expect, describe } from 'bun:test';
import { runCommand } from './runner.js';

describe('Command Runner', () => {
  test('parses positional arguments', async () => {
    const command = {
      args: [{ name: 'slug', required: true }],
      options: {},
      handler: async ({ args }) => args
    };

    const result = await runCommand(command, ['ko002'], {});
    expect(result).toEqual({ slug: 'ko002' });
  });

  test('validates required arguments', async () => {
    const command = {
      args: [{ name: 'slug', required: true }],
      options: {},
      handler: async () => {}
    };

    expect(() => runCommand(command, [], {})).toThrow('missing_argument');
  });

  test('handles flag conflicts', async () => {
    const command = {
      options: {
        json: { type: 'boolean' },
        sql: { type: 'boolean', conflicts: ['json'] }
      },
      handler: async () => {}
    };

    expect(() =>
      runCommand(command, [], { json: true, sql: true })
    ).toThrow('conflicting_options');
  });
});
```

**Test Structure:**
```
/cli-framework/
  index.test.js       # Router tests
  runner.test.js      # Command execution tests
  utils/
    output.test.js    # Formatter tests
    validation.test.js
/src/commands/
  channel/
    list.test.js      # Command-specific tests
```

**Testing approach:**
- **Unit tests** - Test framework components in isolation
- **Integration tests** - Test full command execution flow
- **Fixture commands** - Create fake commands for testing
- **Fast feedback** - Bun test is fast, run on every change

## Next Steps

1. [ ] Build basic router (`/cli-framework/index.js`) with tests
2. [ ] Implement command runner with `parseArgs` (`/cli-framework/runner.js`) with tests
3. [ ] Create sample command to test end-to-end
4. [ ] Add output formatters with tests
5. [ ] Add help generation from command definitions with tests
6. [ ] Integrate with R4 CLI

## Advanced Patterns (Future)

For simple CRUD CLIs, the base design above suffices. Complex cases may need:

**Argument Groups** (like Clap's `ArgGroup`)
```js
groups: {
  output: {
    args: ['json', 'sql'],
    required: true,
    multiple: false  // only one from group
  }
}
```

**Position-Sensitive Args** (like `find -name foo -o -name bar`)
- Not needed for R4 (noun-verb pattern is hierarchical, not sequential)
- If needed: track `indices` from parseArgs, preserve order
- Our use case: all flags are order-independent

**Conditional Requirements**
```js
options: {
  channel: {
    type: 'string',
    required_unless: ['all']
  }
}
```

**Decision: Start simple, add only when needed**
- R4 CLI doesn't need position-sensitive operators
- Start with: args, options, conflicts, validation
- Add groups/conditionals only if real use case emerges

## Implementation Questions

- [x] ~~Auto-discover commands by filesystem scan or explicit registration?~~
  → **Filesystem scan** - Convention over configuration. Scan `/commands` recursively.

- [x] ~~Should framework validate command exports (with Zod)?~~
  → **Yes** - Validate command definition shape at load time, fail fast with helpful errors.

- [x] ~~How to handle shared context (like auth, config)?~~
  → **Context object** - Pass `{ auth, config, output }` to handler. Framework injects.

- [ ] Help text generation strategy?
  → Generate from command definition (description, args, options). Format like man pages.

- [ ] How to handle subcommands discovering their parent's flags?
  → e.g., global `--verbose` flag. Pass through context or parse twice?

## Help Generation

Auto-generate help from command definitions:

```
r4 channel view --help

USAGE
    r4 channel view <slug>... [options]

DESCRIPTION
    View one or more channels in detail

ARGUMENTS
    <slug>...    Channel slug to view (required)

OPTIONS
    --json       Output as JSON (default: true)
    --sql        Output as SQL statements

EXAMPLES
    r4 channel view ko002
    r4 channel view ko002 oskar --sql
```

**Implementation:**
- Framework reads command definition
- Formats args, options, examples from metadata
- Special case: List subcommands if no verb given
  ```
  r4 channel --help

  USAGE
      r4 channel <command>

  COMMANDS
      list      List all channels
      view      View channels in detail
      create    Create a new channel
      update    Update channels
      delete    Delete channels
  ```
