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
		sql: {
			type: 'boolean',
			description: 'Output as SQL statements',
			default: false
		}
	},

	validate: z.object({
		id: z.union([z.string(), z.array(z.string())])
	}),

	handler: async ({args, flags}) => {
		const ids = Array.isArray(args.id) ? args.id : [args.id]
		const tracks = await Promise.all(ids.map((id) => getTrack(id)))

		return {
			data: tracks.length === 1 ? tracks[0] : tracks,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track view abc123',
		'r4 track view abc123 def456',
		'r4 track view abc123 --sql'
	]
}
