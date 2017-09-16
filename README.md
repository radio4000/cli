# r4dl

Downloads a Radio4000 channel.

## How to use

You will need `node` and [youtube-dl](https://github.com/rg3/youtube-dl/#installation) installed on your computer.

1. `git clone git@gitlab.com:internet4000/r4dl.git`
2. `cd r4dl`
3. `yarn link`
4. `r4dl https://radio4000.com/ifeveryoneelseforgets`

## Tests

`npm test`

You can format all scripts using `npm run prettier`.

## Alternatives

If you have `jq` installed, you can actually skip this project and do:

```bash
curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | jq -r '.[] | .url' | youtube-dl -ixa /dev/stdin --audio-format mp3
```

... if you haven't got `jq` - but have `python` - try this:

```bash
curl https://api.radio4000.com/v1/channels/-JYZtdQfLSl6sUpyIJx6/tracks | python -m json.tool | grep -oP '"url": "\K(.+)",' | youtube-dl -a /dev/stdin --extract-audio --audio-format mp3
```

## Credits

- https://github.com/segmentio/nightmare/
- https://github.com/rg3/youtube-dl/