import {updateChannel} from '../../lib/data.js'
import {channelToSQL, toJSON} from '../../lib/formatters.js'
import {parse} from '../../utils.js'

export default {
	description: 'Update one or more channels',

	options: {
		name: {
			type: 'string',
			description: 'New name for the channel(s)'
		},
		description: {
			type: 'string',
			description: 'New description for the channel(s)'
		},
		image: {
			type: 'string',
			description: 'New image URL for the channel(s)'
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

		const updates = {
			name: values.name,
			description: values.description,
			image: values.image
		}

		if (Object.values(updates).every((val) => val === undefined)) {
			throw new Error('At least one field must be provided for update')
		}

		const slugs = positionals
		const channels = await Promise.all(
			slugs.map((slug) => updateChannel(slug, updates))
		)
		const data = channels.length === 1 ? channels[0] : channels

		if (values.sql) return channelToSQL(data)
		return toJSON(data)
	},

	examples: [
		'r4 channel update mysounds --name "New Name"',
		'r4 channel update mysounds --description "Updated description"',
		'r4 channel update ch1 ch2 --name "Same Name"'
	]
}
