import {createChannel} from '../../lib/data.js'
import {parse} from '../../utils.js'

export default {
	description: 'Create a new channel',

	options: {
		name: {
			type: 'string',
			description: 'Channel name (required)'
		},
		description: {
			type: 'string',
			default: '',
			description: 'Channel description'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)

		if (positionals.length === 0) {
			throw new Error('Channel slug is required')
		}

		if (!values.name) {
			throw new Error('--name is required')
		}

		const slug = positionals[0]
		return await createChannel({
			slug,
			name: values.name,
			description: values.description
		})
	},

	examples: [
		'r4 channel create mysounds --name "My Sounds"',
		'r4 channel create mysounds --name "My Sounds" --description "A collection"'
	]
}
