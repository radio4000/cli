import {listChannels} from '../../lib/data.js'
import {channelToSQL, channelToText, toJSON} from '../../lib/formatters.js'
import {parse} from '../../utils.js'

export default {
	description: 'List all channels (from v2 API or bundled v1 data)',

	async run(argv) {
		const {values} = parse(argv, {
			limit: {type: 'number', default: 100},
			format: {type: 'string'}
		})

		const limit = values.limit ?? 100
		const channels = await listChannels({limit})

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
		'r4 channel list --limit 100 --format sql',
		'r4 channel list --format json'
	]
}
