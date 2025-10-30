import {createTrack} from '../../lib/data.js'
import {trackSchema} from '../../lib/schema.js'

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
		}
	},

	validate: trackSchema.pick({title: true, url: true}),

	handler: async (input) => {
		// Why: data.js createTrack expects 'slug' for channel identifier
		return await createTrack({...input, slug: input.channel})
	},

	examples: [
		'r4 track create --channel mysounds --title "Song Name" --url "https://youtube.com/..."',
		'echo \'{"title":"Song","url":"..."}\' | r4 track create --channel mysounds'
	]
}
