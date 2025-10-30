import {sqlOption} from '../../lib/common-options.js'
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
		...sqlOption
	},

	handler: async (input) => {
		const ids = Array.isArray(input.id) ? input.id : [input.id]

		const updates = {}
		if (input.title) updates.title = input.title
		if (input.url) updates.url = input.url

		if (Object.keys(updates).length === 0) {
			throw new Error('At least one field must be provided for update')
		}

		const tracks = await Promise.all(ids.map((id) => updateTrack(id, updates)))

		const format = input.sql ? 'sql' : 'json'
		const data = tracks.length === 1 ? tracks[0] : tracks
		return {
			data,
			format,
			formatOptions: format === 'sql' ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track update abc123 --title "New Title"',
		'r4 track update abc123 --url "https://new-url.com"',
		'r4 track update abc123 def456 --title "Same Title"'
	]
}
