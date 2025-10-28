import {updateTrack} from '../../lib/data.js'

export default {
	description: 'Update one or more tracks',

	args: [
		{
			name: 'id',
			description: 'Track ID(s) to update',
			required: true,
			multiple: true
		}
	],

	options: {
		title: {
			type: 'string',
			description: 'New track title'
		},
		url: {
			type: 'string',
			description: 'New track URL'
		},
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	handler: async ({args, flags}) => {
		const ids = Array.isArray(args.id) ? args.id : [args.id]

		const updates = {}
		if (flags.title) updates.title = flags.title
		if (flags.url) updates.url = flags.url

		if (Object.keys(updates).length === 0) {
			throw new Error('At least one field must be provided for update')
		}

		const tracks = await Promise.all(ids.map((id) => updateTrack(id, updates)))

		return {
			data: tracks.length === 1 ? tracks[0] : tracks,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track update abc123 --title "New Title"',
		'r4 track update abc123 --url "https://new-url.com"',
		'r4 track update abc123 def456 --title "Same Title"'
	]
}
