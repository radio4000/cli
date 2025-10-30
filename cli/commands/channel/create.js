import {sqlOption} from '../../lib/common-options.js'
import {createChannel} from '../../lib/data.js'
import {formatOutput} from '../../lib/formatters.js'
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
			description: input.description || ''
		}

		const channel = await createChannel(channelData)
		const format = input.sql ? 'sql' : 'json'
		const formatOptions = format === 'sql' ? {table: 'channels'} : undefined
		return formatOutput(channel, format, formatOptions)
	},

	examples: [
		'r4 channel create mysounds --name "My Sounds"',
		'r4 channel create mysounds --name "My Sounds" --description "A collection"'
	]
}
