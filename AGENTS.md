> Hey we're making a new CLI in @cli/ using @cli-framework/ (which we adapt) to our own needs. The old cli is also in the repo fyi. See @plan-cli.md . go step by
step. command. test. make it NICE, how could it be elegant. clean lean

We want it to malleable, composable. Beautiful like lisp, haskell and elixir. 

This is a CLI. Test it, use it with `./cli/main.js`. Super for debugging. And if it can't debug it, we can extend it.

Run `bun run check` to lint and format all code.

run `bun test` to test.

If you need a v1 channel to test, use `detecteve`. `ko002` is v2 and has tons of tags to test.

Behind the scenes, it uses @radio4000/sdk to crud most channels and tracks. Fallback to sdk.supabase for more advanced things.
