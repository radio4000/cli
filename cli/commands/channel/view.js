import {formatOption} from '../../lib/common-options.js'
import {getChannel} from '../../lib/data.js'
import {formatOutput} from '../../lib/formatters.js'

/**
 * Format a single channel as human-readable text
 * Used by: r4 channel view --format text and <slug>.txt in downloads
 */
export function formatChannelText(channel) {
	const titleLine = channel.name || 'Untitled Channel'
	const underline = '='.repeat(titleLine.length)
	const description = channel.description || 'No description available.'
	const createdDate = channel.created_at
		? new Date(channel.created_at).toLocaleDateString()
		: 'Unknown'
	const updatedDate = channel.updated_at
		? new Date(channel.updated_at).toLocaleDateString()
		: 'Unknown'

	// Build optional sections
	const sections = []

	if (channel.url) sections.push(`Website: ${channel.url}`)
	if (channel.image) sections.push(`Image: ${channel.image}`)
	if (channel.latitude !== undefined)
		sections.push(`Latitude: ${channel.latitude}`)
	if (channel.longitude !== undefined)
		sections.push(`Longitude: ${channel.longitude}`)
	if (channel.track_count !== undefined)
		sections.push(`Tracks: ${channel.track_count}`)
	if (channel.firebase_id) sections.push(`Firebase ID: ${channel.firebase_id}`)

	const optionalSections =
		sections.length > 0 ? `  ${sections.join('\n  ')}\n` : ''

	return `${titleLine}
${underline}

${description}

Info:
  ID: ${channel.id || 'N/A'}
  Slug: ${channel.slug}
  Source: ${channel.source || 'N/A'}
  Created: ${createdDate}
  Updated: ${updatedDate}
${optionalSections}`
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
		const slugs = Array.isArray(input.slug) ? input.slug : [input.slug]
		const channels = await Promise.all(slugs.map((slug) => getChannel(slug)))
		const format = input.format || 'json'

		// Custom text formatting for channels
		if (format === 'text') {
			return channels.map(formatChannelText).join('\n\n---\n\n')
		}

		// Use generic formatter for json/sql (unwrap if single result)
		const data = channels.length === 1 ? channels[0] : channels
		return formatOutput(data, format, {table: 'channels'})
	},

	examples: [
		'r4 channel view ko002',
		'r4 channel view ko002 oskar',
		'r4 channel view ko002 --format text',
		'r4 channel view ko002 --format json',
		'r4 channel view ko002 --format sql'
	]
}
