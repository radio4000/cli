In this file we can save ideas and tasks for later.

- Add premium/poToken support for YouTube Music. e.g. if you have a premium account you can dl the tracks via that which gives you 256kb

## CLI Framework Simplification (Completed)

Simplified the CLI framework to be more direct and composable:

### Completed Improvements

1. **Consolidated help formatting** - Moved `formatCommandHelp` and `formatCLIError` from `types.js` to `utils/help.js` for better separation of concerns. `types.js` now only contains schemas, error types, and validation.

2. **Removed unused conflicts feature** - Deleted conflict checking (never used in any commands). Removed `conflicts` field from OptionSchema, `CONFLICTING_OPTIONS` error type, and related test suite.

3. **Simplified number type handling** - Streamlined type conversion in `runner.js`. Instead of special-casing number types, all non-boolean types are treated as strings by parseArgs, then converted once.

4. **Removed formatResult wrapper** - Updated all 10 commands to return result objects directly instead of using a wrapper function. Commands now inline the simple object construction.

5. **Removed trivial helper wrappers** - Deleted `cli/lib/command-helpers.js` entirely (~50 lines). Inlined:
   - `toArray(value)` → `Array.isArray(value) ? value : [value]`
   - `singleOrMultiple(items)` → `items.length === 1 ? items[0] : items`
   - `requireUpdates(updates)` → `if (Object.keys(updates).length === 0) throw new Error(...)`

### Results

- **~140 lines of code removed**
- **Better separation of concerns** - types.js is now pure schemas/errors, presentation logic in utils/
- **More direct code** - No unnecessary abstraction layers
- **All 162 tests passing** (98 framework + 64 CLI tests)
- **Cleaner command files** - Inline logic is self-documenting

### Principles Applied

- Don't make wrappers or abstractions if we can avoid them
- Prefer direct property access over getters/setters
- Keep code path direct and clear
- Methods should do meaningful work beyond simple access 
