import {channelSorts, listChannels} from '../../lib/data.js'
import {channelToSQL, channelToText, toJSON} from '../../lib/formatters.js'
import {parse} from '../../utils.js'

export default {
	description: 'List all channels',

	options: {
		limit: {
			type: 'number',
			default: 100,
			description: 'Limit number of results'
		},
		sort: {
			type: 'string',
			default: 'updated',
			description: 'Sort by: updated (latest track), created, tracks, name'
		},
		reverse: {
			type: 'boolean',
			default: false,
			description: 'Reverse the sort order (oldest, fewest, or z-a first)'
		},
		format: {
			type: 'string',
			description: 'Output format: text, json, sql (auto: tty=text, pipe=json)'
		}
	},

	async run(argv) {
		const {values} = parse(argv, this.options)

		if (!channelSorts[values.sort]) {
			throw new Error(
				`--sort must be one of: ${Object.keys(channelSorts).join(', ')}`
			)
		}
		const limit = values.limit ?? 100
		const channels = await listChannels({
			limit,
			sort: values.sort,
			reverse: values.reverse
		})

		// Default to text for TTY (human), json when piped (machine)
		const isTTY = Boolean(process.stdout.isTTY)
		const format = values.format || (isTTY ? 'text' : 'json')

		if (format === 'sql') return channelToSQL(channels)
		if (format === 'text') return channelToText(channels)
		return toJSON(channels)
	},

	examples: [
		'r4 channel list',
		'r4 channel list --limit 10',
		'r4 channel list --sort created --limit 5        # newest channels',
		'r4 channel list --sort tracks --limit 10        # biggest channels',
		'r4 channel list --sort name --reverse',
		'r4 channel list --limit 100 --format sql',
		'r4 channel list --format json'
	]
}
