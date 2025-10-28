import {getChannel} from '../../lib/data.js'
import {toArray, singleOrMultiple} from '../../lib/command-helpers.js'
import {formatOption} from '../../lib/common-options.js'

export default {
	description: 'View detailed information about one or more channels',

	args: [
		{
			name: 'slug',
			description: 'Channel slug(s) to view',
			required: true,
			multiple: true
		}
	],

	options: formatOption,

	handler: async (input) => {
		const slugs = toArray(input.slug)
		const channels = await Promise.all(slugs.map((slug) => getChannel(slug)))
		const format = input.format || 'json'

		return {
			data: singleOrMultiple(channels),
			format: format,
			formatOptions: format === 'sql' ? {table: 'channels'} : undefined
		}
	},

	examples: [
		'r4 channel view ko002',
		'r4 channel view ko002 oskar',
		'r4 channel view ko002 --format sql',
		'r4 channel view ko002 --format json'
	]
}
