# CLI Command Example

This document shows how to create a new command for the R4 CLI.

## File Structure

Commands live in `cli/commands/`. The file path determines the command name:
- `cli/commands/foo.js` → `r4 foo`
- `cli/commands/foo/bar.js` → `r4 foo bar`

## Command Template

```javascript
import {parse} from '../utils.js'

export default {
  // Description: Shows in help text. Keep it concise (one line).
  description: 'Example command showing the CLI structure',

  // Options: Define all flags your command accepts.
  // These are used for BOTH parsing and generating help text.
  options: {
    name: {
      type: 'string',        // 'string' | 'number' | 'boolean'
      description: 'Name to greet',
      default: 'World'       // Optional: default value if flag not provided
    },
    count: {
      type: 'number',
      short: 'c',            // Optional: short flag alias (-c)
      description: 'Number of times to greet',
      default: 1
    },
    tags: {
      type: 'string',
      multiple: true,        // Allows --tags foo --tags bar OR --tags foo,bar
      description: 'Example tags to demonstrate multiple values'
    },
    verbose: {
      type: 'boolean',       // Booleans don't need a value: just --verbose
      short: 'v',
      description: 'Enable verbose output'
    },
    format: {
      type: 'string',
      description: 'Output format: text or json'
    }
  },

  // Run: The main command logic.
  // - Takes argv (array of arguments after the command name)
  // - Returns a string to be printed to stdout (or null/undefined for no output)
  async run(argv) {
    // Parse arguments using this.options
    const {values, positionals} = parse(argv, this.options)

    // Access parsed values
    const name = values.name
    const count = values.count
    const verbose = values.verbose
    const tags = values.tags || []
    const format = values.format || 'text'

    if (verbose) {
      console.error('Verbose mode enabled')
      console.error(`Positional args: ${positionals.join(', ')}`)
    }

    // Build output
    const greetings = []
    for (let i = 0; i < count; i++) {
      greetings.push(`Hello, ${name}!`)
    }

    // Return based on format
    if (format === 'json') {
      return JSON.stringify({
        greetings,
        tags,
        count: greetings.length
      }, null, 2)
    }

    // Default text output
    let output = greetings.join('\n')
    if (tags.length > 0) {
      output += `\nTags: ${tags.join(', ')}`
    }
    return output
  },

  // Examples: Show up in help text.
  // Lead with simple examples, build toward complex ones.
  examples: [
    'r4 example --name Alice',
    'r4 example --name Bob --count 3',
    'r4 example -c 2 -v',
    'r4 example --tags foo --tags bar',
    'r4 example --tags foo,bar,baz',
    'r4 example --format json'
  ]
}
```

## Key Points

1. **Export a default object** with `description`, `options`, `run()`, and `examples`
2. **Options object** is used for both parsing (in `run()`) and help text generation
   - The framework automatically generates `--help` / `-h` output from your `options`
   - Each option's `description` appears in the help text
   - Short flags, defaults, and types are all shown automatically
3. **Use `this.options`** in the `run()` function: `parse(argv, this.options)`
4. **Return a string** from `run()` to print to stdout
5. **Use `console.error()`** for logging/debug output (goes to stderr)
6. **Lead with examples** - users learn by example more than docs
7. **Help is automatic** - users can run `r4 yourcommand --help` without you implementing it

## Option Types

- **`type: 'string'`** - Accepts a value: `--name Alice`
- **`type: 'number'`** - Accepts a number, auto-converted: `--count 5`
- **`type: 'boolean'`** - No value needed: `--verbose`
- **`multiple: true`** - Can be specified multiple times or comma-separated
- **`short: 'c'`** - Adds a short flag alias: `-c` for `--count`
- **`default: value`** - Default value when flag not provided

## Output Formats

Follow the existing pattern:
- Default to **text for TTY** (human-readable)
- Default to **JSON when piped** (machine-readable)
- Allow **`--format`** flag to override

```javascript
const isTTY = Boolean(process.stdout.isTTY)
const format = values.format || (isTTY ? 'text' : 'json')
```

## Real Examples

See existing commands:
- `cli/commands/channel/list.js` - Simple list command
- `cli/commands/track/list.js` - Complex command with multiple options
