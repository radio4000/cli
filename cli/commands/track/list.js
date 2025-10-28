import { listTracks } from '../../lib/data.js';

export default {
	description: 'List all tracks, optionally filtered by channel(s)',

	options: {
		channel: {
			type: 'string',
			description: 'Channel slug to filter by (can be used multiple times)',
			multiple: true
		},
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	handler: async ({ flags }) => {
		const channelSlugs = flags.channel
			? (Array.isArray(flags.channel) ? flags.channel : [flags.channel])
			: undefined;

		const tracks = await listTracks({ channelSlugs });

		return {
			data: tracks,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? { table: 'tracks' } : undefined
		};
	},

	examples: [
		'r4 track list',
		'r4 track list --channel ko002',
		'r4 track list --channel ko002 --channel oskar',
		'r4 track list --sql'
	]
};
