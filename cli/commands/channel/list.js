import {listChannels} from '../../lib/data.js'

export default {
	description: 'List all channels (from v2 API or bundled v1 data)',

	options: {
		limit: {
			type: 'number',
			description: 'Limit number of results (default: 100)',
			default: 100
		},
		format: {
			type: 'string',
			description: 'Output format: text, json, or sql',
			default: 'json'
		}
	},

	handler: async (input) => {
		// Use default limit of 100 if not specified
		const limit = input.limit ?? 100
		const format = input.format || 'json'

		return {
			data: await listChannels({limit}),
			format: format,
			formatOptions: format === 'sql' ? {table: 'channels'} : undefined
		}
	},

	examples: [
		'r4 channel list',
		'r4 channel list --limit 10',
		'r4 channel list --limit 100 --format sql',
		'r4 channel list --format json'
	]
}
