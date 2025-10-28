import {deleteTrack} from '../../lib/data.js'

export default {
	description: 'Delete one or more tracks',

	args: [
		{
			name: 'id',
			description: 'Track ID(s) to delete',
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

	handler: async ({args, flags}) => {
		const ids = Array.isArray(args.id) ? args.id : [args.id]
		const results = await Promise.all(ids.map((id) => deleteTrack(id)))

		return {
			data: results.length === 1 ? results[0] : results,
			format: flags.sql ? 'sql' : 'json',
			formatOptions: flags.sql ? {table: 'tracks'} : undefined
		}
	},

	examples: ['r4 track delete abc123', 'r4 track delete abc123 def456 ghi789']
}
