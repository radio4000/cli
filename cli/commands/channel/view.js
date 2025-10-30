import {formatOption} from '../../lib/common-options.js'
import {getChannel} from '../../lib/data.js'
import {formatOutput} from '../../lib/formatters.js'

/**
 * Format a single channel as human-readable text
 * Used by: r4 channel view --format text and <slug>.txt in downloads
 */
export function formatChannelText(channel) {
	const title = channel.name || 'Untitled Channel'

	// Build optional sections directly
	const optional = [
		channel.url && `Website: ${channel.url}`,
		channel.image && `Image: ${channel.image}`,
		channel.latitude !== undefined && `Latitude: ${channel.latitude}`,
		channel.longitude !== undefined && `Longitude: ${channel.longitude}`,
		channel.track_count !== undefined && `Tracks: ${channel.track_count}`,
		channel.firebase_id && `Firebase ID: ${channel.firebase_id}`
	]
		.filter(Boolean)
		.join('\n  ')

	return `${title}
${'='.repeat(title.length)}

${channel.description}

Info:
  ID: ${channel.id || 'N/A'}
  Slug: ${channel.slug}
  Source: ${channel.source || 'N/A'}
  Created: ${channel.created_at ? new Date(channel.created_at).toLocaleDateString() : 'Unknown'}
  Updated: ${channel.updated_at ? new Date(channel.updated_at).toLocaleDateString() : 'Unknown'}
${optional ? `  ${optional}\n` : ''}`
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
