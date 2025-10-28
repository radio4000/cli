import {z} from 'zod'
import {createTrack} from '../../lib/data.js'
import {sqlOption} from '../../lib/common-options.js'

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
		...sqlOption
	},

	validate: z.object({
		channel: z.string().min(1),
		title: z.string().min(1).max(500),
		url: z.string().url()
	}),

	handler: async (input) => {
		const trackData = {
			slug: input.channel,
			title: input.title,
			url: input.url
		}

		const track = await createTrack(trackData)

		return {
			data: track,
			format: input.sql ? 'sql' : 'json',
			formatOptions: input.sql ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track create --channel mysounds --title "Song Name" --url "https://youtube.com/..."',
		'echo \'{"title":"Song","url":"..."}\' | r4 track create --channel mysounds'
	]
}
