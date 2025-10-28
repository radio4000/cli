import {deleteTrack} from '../../lib/data.js'
import {toArray, singleOrMultiple} from '../../lib/command-helpers.js'
import {sqlOption} from '../../lib/common-options.js'

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
		const ids = toArray(input.id)
		const results = await Promise.all(ids.map((id) => deleteTrack(id)))

		return {
			data: singleOrMultiple(results),
			format: input.sql ? 'sql' : 'json',
			formatOptions: input.sql ? {table: 'tracks'} : undefined
		}
	},

	examples: ['r4 track delete abc123', 'r4 track delete abc123 def456 ghi789']
}
