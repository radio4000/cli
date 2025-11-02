import {channelSQL, trackSQL} from '../lib/schema.js'
import {parse} from '../utils.js'

const schemas = {
	channels: channelSQL,
	tracks: trackSQL
}

const selectSchemas = (values) => {
	const all = Object.keys(schemas)
	const selected =
		values.channels || values.tracks ? all.filter((k) => values[k]) : all
	return selected.map((k) => schemas[k])
}

export default {
	description: 'Output SQL CREATE TABLE statements for channels and tracks',

	options: {
		channels: {
			type: 'boolean',
			description: 'Output only channels table schema'
		},
		tracks: {
			type: 'boolean',
			description: 'Output only tracks table schema'
		}
	},

	async run(argv) {
		const {values} = parse(argv, this.options)

		return selectSchemas(values).join('\n\n')
	},

	examples: [
		'r4 schema',
		'r4 schema --channels',
		'r4 schema --tracks',
		'r4 schema | sqlite3 my.db'
	]
}
