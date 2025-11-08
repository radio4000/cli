import {updateTrack} from '../../lib/data.js'
import {toJSON, trackToSQL} from '../../lib/formatters.js'
import {parse} from '../../utils.js'

export default {
	description: 'Update one or more tracks',

	options: {
		title: {
			type: 'string',
			description: 'New title for the track(s)'
		},
		url: {
			type: 'string',
			description: 'New URL for the track(s)'
		},
		description: {
			type: 'string',
			description: 'New description for the track(s)'
		},
		sql: {
			type: 'boolean',
			description: 'Output result as SQL INSERT statements'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)

		if (positionals.length === 0) {
			throw new Error('At least one track ID is required')
		}

		const updates = {
			title: values.title,
			url: values.url,
			description: values.description
		}

		if (Object.values(updates).every((val) => val === undefined)) {
			throw new Error('At least one field must be provided for update')
		}

		const ids = positionals
		const tracks = await Promise.all(ids.map((id) => updateTrack(id, updates)))
		const data = tracks.length === 1 ? tracks[0] : tracks

		if (values.sql) return trackToSQL(data)
		return toJSON(data)
	},

	examples: [
		'r4 track update <id> --title "New title"',
		'r4 track update <id> --url "https://..."',
		'r4 track update <id> --description "New description"',
		'r4 track update <id1> <id2> --title "Shared title"'
	]
}
