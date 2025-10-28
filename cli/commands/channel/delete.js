import { deleteChannel } from '../../lib/data.js';

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
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	handler: async ({ args, flags }) => {
		const slugs = Array.isArray(args.slug) ? args.slug : [args.slug];
		const results = await Promise.all(slugs.map(slug => deleteChannel(slug)));

		return {
			data: results.length === 1 ? results[0] : results,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? { table: 'channels' } : undefined
		};
	},

	examples: [
		'r4 channel delete mysounds',
		'r4 channel delete ch1 ch2 ch3'
	]
};
