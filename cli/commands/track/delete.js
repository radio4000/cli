import {sqlOption} from '../../lib/common-options.js'
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

	options: sqlOption,

	handler: async (input) => {
		const ids = Array.isArray(input.id) ? input.id : [input.id]
		const results = await Promise.all(ids.map((id) => deleteTrack(id)))
		const format = input.sql ? 'sql' : 'json'
		const data = results.length === 1 ? results[0] : results
		return {
			data,
			format,
			formatOptions: format === 'sql' ? {table: 'tracks'} : undefined
		}
	},

	examples: ['r4 track delete abc123', 'r4 track delete abc123 def456 ghi789']
}
