import {z} from 'zod'
import {getTrack} from '../../lib/data.js'

export default {
	description: 'View detailed information about one or more tracks',

	args: [
		{
			name: 'id',
			description: 'Track ID(s) to view',
			required: true,
			multiple: true
		}
	],

	options: {
		format: {
			type: 'string',
			description: 'Output format: text, json, or sql',
			default: 'json'
		}
	},

	validate: z.object({
		id: z.union([z.string(), z.array(z.string())]),
		format: z.enum(['json', 'sql', 'text']).default('json')
	}),

	handler: async (input) => {
		const ids = Array.isArray(input.id) ? input.id : [input.id]
		const tracks = await Promise.all(ids.map((id) => getTrack(id)))
		const format = input.format || 'json'

		return {
			data: tracks.length === 1 ? tracks[0] : tracks,
			format: format,
			formatOptions: format === 'sql' ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track view abc123',
		'r4 track view abc123 def456',
		'r4 track view abc123 --format sql',
		'r4 track view abc123 --format json'
	]
}
