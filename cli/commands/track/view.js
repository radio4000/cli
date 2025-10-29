import {singleOrMultiple, toArray} from '../../lib/command-helpers.js'
import {formatOption} from '../../lib/common-options.js'
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

	options: formatOption,

	handler: async (input) => {
		const ids = toArray(input.id)
		const tracks = await Promise.all(ids.map((id) => getTrack(id)))
		const format = input.format || 'json'

		return {
			data: singleOrMultiple(tracks),
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
