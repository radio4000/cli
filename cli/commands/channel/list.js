import {formatOption} from '../../lib/common-options.js'
import {listChannels} from '../../lib/data.js'
import {formatOutput} from '../../lib/formatters.js'

/** @type {import('../../../cli-framework/types.js').CommandDefinition} */
export default {
	description: 'List all channels (from v2 API or bundled v1 data)',

	options: {
		limit: {
			type: 'number',
			description: 'Limit number of results (default: 100)',
			default: 100
		},
		...formatOption
	},

	handler: async (input) => {
		const limit = input.limit ?? 100
		const channels = await listChannels({limit})
		const format = input.format || 'json'
		return formatOutput(channels, format, {table: 'channels'})
	},

	examples: [
		'r4 channel list',
		'r4 channel list --limit 10',
		'r4 channel list --limit 100 --format sql',
		'r4 channel list --format json'
	]
}
