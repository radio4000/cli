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

```javascript
import { executeCommand, listCommands, listAllCommands } from './cli-framework/index.js'

/** @type {import('./types.js').CommandDefinition} */
export default {
  description: 'View channel details',
  args: [{ name: 'slug', required: true }],
  handler: async (input) => {
    return await getChannel(input.slug);
  }
}

await executeCommand({ commandsDir, argv, context })
await listCommands(commandsDir) // not recursive
await listAllCommands(commandsDir) // recursive
```

## Command Definition

### Positional Arguments

```javascript
export default {
  description: 'Delete a channel',
  args: [
    { name: 'slug', required: true },
    { name: 'reason', required: false }
  ],
  handler: async (input) => {
    // input.slug, input.reason
  }
}
```

**Multiple values:**
```javascript
args: [{ name: 'slugs', required: true, multiple: true }]
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
      type: 'string',
      description: 'Max results',
      parse: (val) => parseInt(val, 10)
    },
    verbose: {
      type: 'boolean',
      short: 'v',
      description: 'Verbose output'
    }
  },
  handler: async (input) => {
    // input.json, input.limit, input.verbose
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

Use Zod schemas for type-safe validation:

```javascript
import { z } from 'zod'

export default {
  description: 'Create channel',
  args: [{ name: 'slug', required: true }],
  options: {
    tags: { type: 'string', multiple: true }
  },
  validate: z.object({
    slug: z.string().min(3).max(50),
    tags: z.array(z.string()).optional()
  }),
  handler: async (input) => {
    // input is validated and typed
  }
}
```

## Examples

See [../cli/commands/](../cli/commands/) for real-world command implementations.