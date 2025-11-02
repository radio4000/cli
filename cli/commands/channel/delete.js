import {deleteChannel} from '../../lib/data.js'
import {channelToSQL, toJSON} from '../../lib/formatters.js'
import {parse} from '../../utils.js'

export default {
	description: 'Delete one or more channels',

	options: {
		confirm: {
			type: 'boolean',
			description: 'Confirm deletion (required for safety)'
		},
		sql: {
			type: 'boolean',
			description: 'Output result as SQL INSERT statements'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)

		if (positionals.length === 0) {
			throw new Error('At least one channel slug is required')
		}

		if (!values.confirm) {
			throw new Error('--confirm flag is required for safety')
		}

		const slugs = positionals
		const results = await Promise.all(slugs.map((slug) => deleteChannel(slug)))
		const data = results.length === 1 ? results[0] : results

		if (values.sql) return channelToSQL(data)
		return toJSON(data)
	},

	examples: [
		'r4 channel delete mysounds --confirm',
		'r4 channel delete ch1 ch2 ch3 --confirm'
	]
}
