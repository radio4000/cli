import {updateChannel} from '../../lib/data.js'
import {toArray, singleOrMultiple, requireUpdates} from '../../lib/command-helpers.js'
import {sqlOption} from '../../lib/common-options.js'

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
		const slugs = toArray(input.slug)

		const updates = {}
		if (input.name) updates.name = input.name
		if (input.description !== undefined) updates.description = input.description
		if (input.image !== undefined) updates.image = input.image

		requireUpdates(updates)

		const channels = await Promise.all(
			slugs.map((slug) => updateChannel(slug, updates))
		)

		return {
			data: singleOrMultiple(channels),
			format: input.sql ? 'sql' : 'json',
			formatOptions: input.sql ? {table: 'channels'} : undefined
		}
	},

	examples: [
		'r4 channel update mysounds --name "New Name"',
		'r4 channel update mysounds --description "Updated description"',
		'r4 channel update ch1 ch2 --name "Same Name"'
	]
}
