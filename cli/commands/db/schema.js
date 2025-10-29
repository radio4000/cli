import {channelSQL, trackSQL} from '../../lib/schema.js'

const schemas = {
	channels: channelSQL,
	tracks: trackSQL
}

const selectSchemas = (input) => {
	const all = Object.keys(schemas)
	const selected =
		input.channels || input.tracks ? all.filter((k) => input[k]) : all
	return selected.map((k) => schemas[k])
}

export default {
	description: 'Output SQL CREATE TABLE statements for channels and tracks',

	options: {
		channels: {
			type: 'boolean',
			description: 'Output only channels schema'
		},
		tracks: {
			type: 'boolean',
			description: 'Output only tracks schema'
		}
	},

	handler: async (input) => ({
		data: selectSchemas(input).join('\n\n'),
		format: 'text'
	}),

	examples: [
		'r4 db schema',
		'r4 db schema --channels',
		'r4 db schema --tracks',
		'r4 db schema | sqlite3 my.db'
	]
}
