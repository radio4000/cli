# CLI Framework

A lightweight CLI framework for building composable command-line tools.

## Features

- File-based command routing (`commands/` directory)
- Type-safe command definitions with Zod validation
- Auto-generated help commands
- Support for positional arguments and flags
- Multiple values per flag (e.g., `--tag a --tag b` or `--tag a,b,c`)
- Short flags (e.g., `-v` for `--verbose`)
- Custom parsers and validators
- Zero dependencies except Node.js `util.parseArgs` and Zod

## Testing

```bash
bun test cli-framework/
```

## Quick Start

**Create a command** (`commands/hello.js`):
```javascript
/** @type {import('./cli-framework/types.js').CommandDefinition} */
export default {
  description: 'Say hello',
  args: [
    { name: 'name', required: true, description: 'Your name' }
  ],
  handler: async (input) => {
    return `Hello, ${input.name}!`
  }
}
```

**Execute it** (`main.js`):
```javascript
import { executeCommand, listCommands, listAllCommands } from './cli-framework/index.js'

const result = await executeCommand({
  commandsDir: './commands',
  argv: process.argv.slice(2),
  context: {} // shared data passed to all handlers
})

console.log(result)
```

**Run it:**
```bash
node main.js hello world
# => Hello, world!
```

**API:**
```javascript
await executeCommand({ commandsDir, argv, context })
await listCommands(commandsDir)     // top-level only
await listAllCommands(commandsDir)  // recursive
```

## Command Definition

### Positional Arguments

```javascript
export default {
  description: 'Delete a channel',
  args: [
    { name: 'slug', required: true, description: 'Channel slug' },
    { name: 'reason', required: false, description: 'Deletion reason' }
  ],
  handler: async (input) => {
    // input.slug, input.reason
  }
}
```

**Multiple values:**
```javascript
args: [
  { name: 'slugs', required: true, multiple: true, description: 'Channel slugs' }
]
// CLI: r4 command slug1 slug2 slug3
// input.slugs = ['slug1', 'slug2', 'slug3']
```

### Options (Flags)

```javascript
export default {
  description: 'List channels',
  options: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false
    },
    limit: {
      type: 'number',
      description: 'Max results'
    },
    verbose: {
      type: 'boolean',
      short: 'v',
      description: 'Verbose output'
    }
  },
  handler: async (input) => {
    // input.json (boolean)
    // input.limit (number)
    // input.verbose (boolean)
  }
}
```

**Supported types:**
- `'boolean'` - true/false flags
- `'string'` - text values
- `'number'` - numeric values (auto-converted from strings)

**Custom parsing:**
```javascript
options: {
  date: {
    type: 'string',
    description: 'Date in YYYY-MM-DD format',
    parse: (val) => new Date(val)
  }
}
```

**Multiple values:**
```javascript
options: {
  tag: {
    type: 'string',
    description: 'Filter by tags',
    multiple: true
  }
}
// CLI: r4 command --tag jazz --tag ambient
// OR:  r4 command --tag jazz,ambient,drone
// input.tag = ['jazz', 'ambient', 'drone']
```

**Required options:**
```javascript
options: {
  email: {
    type: 'string',
    required: true,
    description: 'User email'
  }
}
```

### Validation

Use Zod schemas for runtime validation and type safety:

```javascript
import { z } from 'zod'

export default {
  description: 'Create channel',
  args: [
    { name: 'slug', required: true, description: 'Channel slug' }
  ],
  options: {
    tags: {
      type: 'string',
      multiple: true,
      description: 'Channel tags'
    }
  },
  validate: z.object({
    slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
    tags: z.array(z.string()).optional()
  }),
  handler: async (input) => {
    // input is validated and typed
    // TypeScript will infer types from the Zod schema
  }
}
```

The `validate` schema runs after argument/option parsing and throws a `CLIError` if validation fails.

## Examples

See [../cli/commands/](../cli/commands/) for real-world command implementations.