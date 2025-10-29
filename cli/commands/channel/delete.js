import {singleOrMultiple, toArray} from '../../lib/command-helpers.js'
import {sqlOption} from '../../lib/common-options.js'
import {deleteChannel} from '../../lib/data.js'

export default {
	description: 'Delete one or more channels',

	args: [
		{
			name: 'slug',
			description: 'Channel slug(s) to delete',
			required: true,
			multiple: true
		}
	],

	options: {
		confirm: {
			type: 'boolean',
			description: 'Confirm deletion (required for safety)',
			required: true
		},
		...sqlOption
	},

	handler: async (input) => {
		const slugs = toArray(input.slug)
		const results = await Promise.all(slugs.map((slug) => deleteChannel(slug)))

		return {
			data: singleOrMultiple(results),
			format: input.sql ? 'sql' : 'json',
			formatOptions: input.sql ? {table: 'channels'} : undefined
		}
	},

	examples: ['r4 channel delete mysounds', 'r4 channel delete ch1 ch2 ch3']
}
