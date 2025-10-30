import {z} from 'zod'
import {sqlOption} from '../../lib/common-options.js'
import {createTrack} from '../../lib/data.js'

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
		const format = input.sql ? 'sql' : 'json'
		return {
			data: track,
			format,
			formatOptions: format === 'sql' ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track create --channel mysounds --title "Song Name" --url "https://youtube.com/..."',
		'echo \'{"title":"Song","url":"..."}\' | r4 track create --channel mysounds'
	]
}
