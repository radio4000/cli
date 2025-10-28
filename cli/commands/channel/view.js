import { getChannel } from '../../lib/data.js';
import { z } from 'zod';

export default {
	description: 'View detailed information about one or more channels',

	args: [
		{
			name: 'slug',
			description: 'Channel slug(s) to view',
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

	validate: z.object({
		slug: z.union([z.string(), z.array(z.string())])
	}),

	handler: async ({ args, flags }) => {
		const slugs = Array.isArray(args.slug) ? args.slug : [args.slug];
		const channels = await Promise.all(slugs.map(slug => getChannel(slug)));

		return {
			data: channels.length === 1 ? channels[0] : channels,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? { table: 'channels' } : undefined
		};
	},

	examples: [
		'r4 channel view ko002',
		'r4 channel view ko002 oskar',
		'r4 channel view ko002 --sql'
	]
};
