import {updateTrack} from '../../lib/data.js'
import {toArray, singleOrMultiple, requireUpdates} from '../../lib/command-helpers.js'
import {sqlOption} from '../../lib/common-options.js'

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
		const ids = toArray(input.id)

		const updates = {}
		if (input.title) updates.title = input.title
		if (input.url) updates.url = input.url

		requireUpdates(updates)

		const tracks = await Promise.all(ids.map((id) => updateTrack(id, updates)))

		return {
			data: singleOrMultiple(tracks),
			format: input.sql ? 'sql' : 'json',
			formatOptions: input.sql ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track update abc123 --title "New Title"',
		'r4 track update abc123 --url "https://new-url.com"',
		'r4 track update abc123 def456 --title "Same Title"'
	]
}
