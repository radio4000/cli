import {sqlOption} from '../../lib/common-options.js'
import {updateChannel} from '../../lib/data.js'
import {formatOutput} from '../../lib/formatters.js'

export default {
	description: 'Update one or more channels',

	args: [
		{
			name: 'slug',
			description: 'Channel slug(s) to update',
			required: true,
			multiple: true
		}
	],

	options: {
		name: {
			type: 'string',
			description: 'New channel name'
		},
		description: {
			type: 'string',
			description: 'New channel description'
		},
		image: {
			type: 'string',
			description: 'New channel image URL'
		},
		...sqlOption
	},

	handler: async (input) => {
		const slugs = Array.isArray(input.slug) ? input.slug : [input.slug]

		const updates = {
			name: input.name,
			description: input.description,
			image: input.image
		}

		if (Object.values(updates).every((val) => val === undefined)) {
			throw new Error('At least one field must be provided for update')
		}

		const channels = await Promise.all(
			slugs.map((slug) => updateChannel(slug, updates))
		)

		const format = input.sql ? 'sql' : 'json'
		const data = channels.length === 1 ? channels[0] : channels
		const formatOptions = format === 'sql' ? {table: 'channels'} : undefined
		return formatOutput(data, format, formatOptions)
	},

	examples: [
		'r4 channel update mysounds --name "New Name"',
		'r4 channel update mysounds --description "Updated description"',
		'r4 channel update ch1 ch2 --name "Same Name"'
	]
}
