import {createChannel} from '../../lib/data.js'
import {channelSchema} from '../../lib/schema.js'
import {sqlOption} from '../../lib/common-options.js'

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
		},
		image: {
			type: 'string',
			description: 'Channel image URL',
			default: ''
		},
		...sqlOption
	},

	validate: channelSchema
		.pick({slug: true, name: true, description: true, image: true})
		.partial({description: true, image: true}),

	handler: async (input) => {
		const channelData = {
			slug: input.slug,
			name: input.name,
			description: input.description || '',
			image: input.image || ''
		}

		const channel = await createChannel(channelData)

		return {
			data: channel,
			format: input.sql ? 'sql' : 'json',
			formatOptions: input.sql ? {table: 'channels'} : undefined
		}
	},

	examples: [
		'r4 channel create mysounds --name "My Sounds"',
		'r4 channel create mysounds --name "My Sounds" --description "A collection"'
	]
}
