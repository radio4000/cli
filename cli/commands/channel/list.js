import {listChannels} from '../../lib/data.js'

export default {
	description: 'List all channels (from v2 API or bundled v1 data)',

	options: {
		limit: {
			type: 'number',
			description: 'Limit number of results'
		},
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	handler: async ({flags}) => ({
		data: await listChannels({limit: flags.limit}),
		format: flags.sql ? 'sql' : 'json',
		formatOptions: flags.sql ? {table: 'channels'} : undefined
	}),

	examples: [
		'r4 channel list',
		'r4 channel list --limit 10',
		'r4 channel list --sql'
	]
}
