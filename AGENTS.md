Hey we're making a new CLI in @cli/ - it's malleable, composable, beautiful like lisp, haskell and elixir.
This is a CLI. Test it, use it with `r4`. Super for debugging. And if it can't debug it, propose changes in @plan.md.

Run the cli with `r4`. This works when you `bun link`.
Remember you can pipe the outputs of each command. It's quite flexible.

## Architecture

cli/
cli/utils.js - Utilities to build the CLI (route, parse, listAllCommands)
cli/main.js - Main entry point and linked as `r4` 
cli/commands - One file per (sub)command
cli/lib - Helpers for the CLI commands

## Commands

Commands follow this pattern:
```javascript
import {parse} from '../utils.js'

export default {
  description: 'Command description',
  async run(argv) {
    const {values, positionals} = parse(argv, {
      format: {type: 'string', default: 'json'},
      limit: {type: 'number', default: 100}
    })
    // do work...
    return result
  }
}
```

but if you want automatic help, see full example read @CLI_COMMAND_EXAMPLE.md.

## Development

```bash
bun install
bun run check # formats and lints, use it!
bun run test
bun link
r4 
```

### Principles 

- Don't make wrappers or abstractions if we can avoid them
- Prefer direct property access over getters/setters
- Methods should do meaningful work beyond simple access 
- When reviewing plan.md remember it is a suggestion of backlog ideas to evaluate, not follow blindly. Tackle them one by one. Delete completed items, no need to keep them around.
