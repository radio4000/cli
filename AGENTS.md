Hey we're making a new CLI in @cli/ using @cli-framework/ (which we adapt) to our own needs. 
We want it to malleable, composable. Beautiful like lisp, haskell and elixir. 
This is a CLI. Test it, use it with `r4`. Super for debugging. And if it can't debug it, we can extend it.

## Architecture

- **cli-framework/** - Reusable CLI framework (routing, parsing, validation)
- **cli/** - R4-specific CLI implementation
- **cli/commands/** - Command definitions (file-per-subcommand)
- **cli/lib/** - Shared utilities (data layer, schema validation)
- See [cli-framework/README.md](cli-framework/README.md) 


## Development

### Testing
```bash
bun run check (formats and lints)
bun test
```

### Running the CLI
```bash
bun cli/index.js channel list --limit 10
# If linked with `bun link`, just call it with `r4 help`
```

### Principles 

- Don't make wrappers or abstractions if we can avoid them
- Prefer direct property access over getters/setters
- Keep code path direct and clear
- Methods should do meaningful work beyond simple access 
