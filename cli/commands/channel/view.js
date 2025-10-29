import {singleOrMultiple, toArray} from '../../lib/command-helpers.js'
import {formatOption} from '../../lib/common-options.js'
import {getChannel} from '../../lib/data.js'

/**
 * Format a single channel as human-readable text
 * Used by: r4 channel view --format text and ABOUT.txt in downloads
 */
export function formatChannelText(channel) {
	const titleLine = channel.name || 'Untitled Channel'
	const underline = '='.repeat(titleLine.length)
	const description = channel.description || 'No description available.'
	const createdDate = channel.created_at
		? new Date(channel.created_at).toLocaleDateString()
		: 'Unknown'
	const websiteSection = channel.url ? `Website: ${channel.url}\n` : ''

	return `${titleLine}
${underline}

${description}

Info:
  Slug: ${channel.slug}
  Created: ${createdDate}
  ${websiteSection}`
}

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

		// For text format, use custom formatter
		if (format === 'text') {
			const formatted = channels.map(formatChannelText).join('\n\n---\n\n')
			return {
				data: formatted,
				format: 'text'
			}
		}

		// For json/sql, return raw data
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
