import { listChannels } from '../../lib/data.js';

export default {
	description: 'List all channels (from v2 API or bundled v1 data)',

	options: {
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	handler: async ({ flags }) => ({
		data: await listChannels(),
		format: flags.sql ? 'sql' : 'json',
		formatOptions: flags.sql ? { table: 'channels' } : undefined
	}),

	examples: [
		'r4 channel list',
		'r4 channel list --sql'
	]
};
