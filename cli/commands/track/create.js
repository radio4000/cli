import {createTrack} from '../../lib/data.js'
import {parse} from '../../utils.js'

export default {
	description: 'Create a new track',

	options: {
		channel: {
			type: 'string',
			description: 'Channel slug (required)'
		},
		title: {
			type: 'string',
			description: 'Track title (required)'
		},
		url: {
			type: 'string',
			description: 'Track URL (required)'
		}
	},

	async run(argv) {
		const {values} = parse(argv, this.options)

		if (!values.channel) {
			throw new Error('--channel is required')
		}
		if (!values.title) {
			throw new Error('--title is required')
		}
		if (!values.url) {
			throw new Error('--url is required')
		}

		return await createTrack({
			slug: values.channel,
			title: values.title,
			url: values.url
		})
	},

	examples: [
		'r4 track create --channel mysounds --title "Song Name" --url "https://youtube.com/..."',
		'echo \'{"title":"Song","url":"..."}\' | r4 track create --channel mysounds'
	]
}
