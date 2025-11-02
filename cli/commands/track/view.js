import {getTrack} from '../../lib/data.js'
import {toJSON, trackToSQL, trackToText} from '../../lib/formatters.js'
import {parse} from '../../utils.js'

export default {
	description: 'View detailed information about one or more tracks',

	async run(argv) {
		const {values, positionals} = parse(argv, {
			format: {type: 'string'}
		})

		if (positionals.length === 0) {
			throw new Error('At least one track ID is required')
		}

		const ids = positionals
		const tracks = await Promise.all(ids.map((id) => getTrack(id)))
		const format = values.format || 'json'
		const data = tracks.length === 1 ? tracks[0] : tracks

		if (format === 'sql') return trackToSQL(data)
		if (format === 'text') return trackToText(data)
		return toJSON(data)
	},

	examples: [
		'r4 track view abc123',
		'r4 track view abc123 def456',
		'r4 track view abc123 --format sql',
		'r4 track view abc123 --format json'
	]
}
