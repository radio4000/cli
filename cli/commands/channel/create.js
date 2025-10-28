import {createChannel} from '../../lib/data.js'
import {channelSchema} from '../../lib/schema.js'

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
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	validate: channelSchema
		.pick({slug: true, name: true, description: true, image: true})
		.partial({description: true, image: true}),

	handler: async ({args, flags}) => {
		const channelData = {
			slug: args.slug,
			name: flags.name,
			description: flags.description || '',
			image: flags.image || ''
		}

		const channel = await createChannel(channelData)

		return {
			data: channel,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? {table: 'channels'} : undefined
		}
	},

	examples: [
		'r4 channel create mysounds --name "My Sounds"',
		'r4 channel create mysounds --name "My Sounds" --description "A collection"'
	]
}
