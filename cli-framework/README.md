# CLI Framework

A little CLI framework made for the @radio4000/r4 CLI.

It offers

- Every command is a file in the `commands/` directory
- Commands follow a `CommandDefinition` schema
- Auto-generated help commands
- No dependencies but node's util.parseArgs and Zod validation

## Testing

```bash
bun test cli-framework/
```

## Quick start

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

See [../cli/index.js](../cli/index.js) for a complete example.