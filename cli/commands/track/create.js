import { createTrack } from '../../lib/data.js';
import { trackSchema } from '../../lib/schema.js';

export default {
	description: 'Create a new track',

	options: {
		channel: {
			type: 'string',
			description: 'Channel slug',
			required: true
		},
		title: {
			type: 'string',
			description: 'Track title',
			required: true
		},
		url: {
			type: 'string',
			description: 'Track URL',
			required: true
		},
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	validate: trackSchema
		.pick({ title: true, url: true })
		.extend({ channel: trackSchema.shape.slug }),

	handler: async ({ flags }) => {
		const trackData = {
			slug: flags.channel,
			title: flags.title,
			url: flags.url
		};

		const track = await createTrack(trackData);

		return {
			data: track,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? { table: 'tracks' } : undefined
		};
	},

	examples: [
		'r4 track create --channel mysounds --title "Song Name" --url "https://youtube.com/..."',
		'echo \'{"title":"Song","url":"..."}\' | r4 track create --channel mysounds'
	]
};
