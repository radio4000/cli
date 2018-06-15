NAME

r4 - the Radio4000 CLI


USAGE

r4 download <channel-slug>
r4 listen <channel-slug>
r4 <command> help
r4 -h, --help
r4 -v, --version


DESCRIPTION

r4 is a program for interacting with Radio4000.123456


INSTALLATION

For now, the the only way to use it is to clone this repository and link it:

You will need `node` and [youtube-dl](https://github.com/rg3/youtube-dl/#installation) installed.

1. `git clone git@github.com:internet4000/r4.git`
2. `cd r4`
3. `yarn link`
4. Now you can run `r4` anywhere on your system


DEVELOPMENT

Lint scripts and run tests with `yarn test`.
To fix linting, try `xo --fix`.

If you you are changing the path or adding a new binary, remember to run `yarn unlink` and `yarn link` in the project.


FURTHER NOTES

If you have `jq` installed, you can actually download the tracks of a channel with this one-liner:

curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | jq -r '.[] | .url' | youtube-dl -ixa /dev/stdin --audio-format mp3

... if you don't have `jq`, but have `python`, try this:

curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | python -m json.tool | grep -oP '"url": "\K(.+)",' | youtube-dl -a /dev/stdin --extract-audio --audio-format mp3
