import {formatOption} from '../../lib/common-options.js'
import {listTracks} from '../../lib/data.js'
import {formatJSON, formatSQL} from '../../lib/formatters.js'
import {filterTracksByTags} from '../../lib/tags.js'

/**
 * Format a single track as text (title + URL)
 * Used by track list and download commands
 */
export function formatTrackText(track) {
	return `  ${track.title}\n    ${track.url}`
}

function formatTrackSummary(tracks, limit) {
	const totalCount = tracks.length
	const displayLimit = limit || 10
	const displayTracks = tracks.slice(0, displayLimit)

	const lines = []

	if (totalCount > 0) {
		const showing = Math.min(displayLimit, totalCount)
		lines.push(`Showing ${showing} track${showing !== 1 ? 's' : ''}:`)

		displayTracks.forEach((track) => {
			lines.push(formatTrackText(track))
		})

		if (totalCount > displayLimit) {
			lines.push('')
			lines.push(`... and ${totalCount - displayLimit} more`)
		}

		lines.push('')
		lines.push('Use --format json or --format sql for full data export')
		if (!limit) {
			lines.push('Use --limit N to show more tracks in summary')
		}
	}

	return lines.join('\n')
}

export default {
	description:
		'List tracks for specified channel(s), optionally filtered by tags',

	options: {
		channel: {
			type: 'string',
			description: 'Channel slug to filter by (can be used multiple times)',
			multiple: true,
			required: true
		},
		tag: {
			type: 'string',
			description: 'Filter by tag (supports --tag a --tag b or --tag a,b,c)',
			multiple: true
		},
		'match-all': {
			type: 'boolean',
			description:
				'When using multiple tags, require all tags to match (AND logic)',
			default: false
		},
		limit: {
			type: 'number',
			description: 'Limit number of results'
		},
		format: {
			...formatOption.format,
			default: 'text'
		}
	},

	handler: async (input) => {
		const channelSlugs = input.channel && [input.channel].flat()
		const format = input.format || 'text'
		const tags = input.tag
			? Array.isArray(input.tag)
				? input.tag
				: [input.tag]
			: null
		const matchAll = input['match-all'] || false

		// Fetch all tracks from channel(s), don't apply limit yet if filtering by tags
		let tracks = await listTracks({
			channelSlugs,
			limit: tags ? undefined : input.limit
		})

		// Filter by tags if specified
		if (tags && tags.length > 0) {
			tracks = filterTracksByTags(tracks, tags, matchAll)
			// Apply limit after filtering
			if (input.limit) {
				tracks = tracks.slice(0, input.limit)
			}
		}

		// Handle empty results for text format
		if (format === 'text' && tracks.length === 0) {
			if (tags) {
				const tagLogic = matchAll ? 'all of' : 'any of'
				return `No tracks found with ${tagLogic}: ${tags.join(', ')}`
			}
			return 'No tracks found'
		}

		// Format based on requested format
		if (format === 'text') {
			return formatTrackSummary(tracks, input.limit)
		}
		if (format === 'sql') {
			return formatSQL(tracks, {table: 'tracks'})
		}
		return formatJSON(tracks)
	},

	examples: [
		'r4 track list --channel ko002',
		'r4 track list --channel ko002 --limit 20',
		'r4 track list --channel ko002 --format json',
		'r4 track list --channel ko002 --format sql',
		'r4 track list --channel ko002 --channel oskar',
		'r4 track list --channel ko002 --tag jazz',
		'r4 track list --channel ko002 --tag jazz --tag ambient',
		'r4 track list --channel ko002 --tag jazz,ambient,drone',
		'r4 track list --channel ko002 --tag house --tag techno --match-all'
	]
}
