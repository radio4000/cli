# NAME

r4 - the Radio4000 CLI

# USAGE

```
r4 download <channel-slug>
r4 <command> help
r4 -h, --help
r4 -v, --version
```

# DESCRIPTION

r4 is a program for interacting with Radio4000.

# INSTALLATION

For downloads to work, make sure
`[youtube-dl](https://github.com/rg3/youtube-dl/)` and `ffmpeg`
installed on your system.

Prefer `npm` (over `yarn`, as the yarn linking is not global with nvm).

## From npm

- `npm i -g r4`, to install r4 globally
- `r4` should now be available as a command in your terminal/shell

# Get channels, pipe to jq, convert to SQL
  r4 channel list --limit 10 | jq '.[].slug'
  r4 channel list --limit 5 --sql > channels.sql

## From repo directly

To install r4 as a global npm package from a gitab repository do:

- `npm i -g github:radio4000/r4`

# DEVELOPMENT

1. git clone git@github.com:radio4000/r4.git
2. cd r4
3. npm link

Linking makes `r4` use your local copy. If you you are changing the
path or adding a new binary, remember to run `npm unlink` and `npm link` in the project.

Lint scripts and run tests with `npm run test`.
To format scripts, run `npm run prettier`.


# FURTHER NOTES

If you have `jq` installed, you can actually download the tracks of a channel with this one-liner:

```
curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | jq -r '.[] | .url' | youtube-dl -ixa /dev/stdin --audio-format mp3
```
... if you don't have `jq`, but have `python`, try this:

```
curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | python -m json.tool | grep -oP '"url": "\K(.+)",' | youtube-dl -a /dev/stdin --extract-audio --audio-format mp3
```
