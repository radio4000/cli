import {getChannel} from '../../lib/data.js'
import {channelToSQL, channelToText, toJSON} from '../../lib/formatters.js'
import {parse} from '../../utils.js'

export default {
	description: 'View detailed information about one or more channels',

	options: {
		format: {
			type: 'string',
			description: 'Output format: json, sql, text (default: json)'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)

		if (positionals.length === 0) {
			throw new Error('At least one channel slug is required')
		}

		const slugs = positionals
		const channels = await Promise.all(slugs.map((slug) => getChannel(slug)))
		const format = values.format || 'json'
		const data = channels.length === 1 ? channels[0] : channels

		if (format === 'sql') return channelToSQL(data)
		if (format === 'text') return channelToText(data)
		return toJSON(data)
	},

	examples: [
		'r4 channel view ko002',
		'r4 channel view ko002 oskar',
		'r4 channel view ko002 --format text',
		'r4 channel view ko002 --format json',
		'r4 channel view ko002 --format sql'
	]
}
