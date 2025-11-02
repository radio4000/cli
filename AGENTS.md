Hey we're making a new CLI in @cli/ - it's malleable, composable, beautiful like lisp, haskell and elixir.
This is a CLI. Test it, use it with `r4`. Super for debugging. And if it can't debug it, we can extend it.

Run the cli with `r4` (this is linked with `bun link` to ./cli/main.js). Remember you can pipe the outputs of each command. It's quite flexible.

## Architecture

- **cli/** - R4 CLI implementation
  - **cli/main.js** - Entry point with routing
  - **cli/utils.js** - Lightweight utilities (route, parse, listAllCommands) - 150 lines
  - **cli/commands/** - Command definitions (file-per-subcommand)
  - **cli/lib/** - Shared utilities (data layer, schema validation, formatters)

Commands follow this simple pattern:
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

## Development
```bash
bun install
bun run check # formats and lints
bun run test
bun link
r4 
```

### Principles 

- Don't make wrappers or abstractions if we can avoid them
- Prefer direct property access over getters/setters
- Keep code path direct and clear
- Methods should do meaningful work beyond simple access 
