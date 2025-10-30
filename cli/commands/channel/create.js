import {createChannel} from '../../lib/data.js'
import {channelSchema} from '../../lib/schema.js'

/** @type {import('../../../cli-framework/types.js').CommandDefinition} */
export default {
	description: 'Create a new channel',

	args: [
		{
			name: 'slug',
			description: 'Channel slug (e.g., my-sounds)',
			required: true,
			multiple: false
		}
	],

	options: {
		name: {
			type: 'string',
			description: 'Channel name',
			required: true
		},
		description: {
			type: 'string',
			description: 'Channel description',
			default: ''
		}
	},

	validate: channelSchema.pick({slug: true, name: true, description: true}),

	handler: async (input) => {
		return await createChannel(input)
	},

	examples: [
		'r4 channel create mysounds --name "My Sounds"',
		'r4 channel create mysounds --name "My Sounds" --description "A collection"'
	]
}
