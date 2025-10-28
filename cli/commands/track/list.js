import {listTracks} from '../../lib/data.js'
import {formatOption} from '../../lib/common-options.js'

function formatTrackSummary(tracks, limit) {
	const totalCount = tracks.length
	const displayLimit = limit || 10
	const displayTracks = tracks.slice(0, displayLimit)

	const lines = []
	lines.push(`Found ${totalCount} track${totalCount !== 1 ? 's' : ''}`)
	lines.push('')

	if (totalCount > 0) {
		const showing = Math.min(displayLimit, totalCount)
		lines.push(`Showing ${showing} track${showing !== 1 ? 's' : ''}:`)

		displayTracks.forEach((track) => {
			lines.push(`  ${track.title}`)
			lines.push(`    ${track.url}`)
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
	description: 'List tracks for specified channel(s)',

	options: {
		channel: {
			type: 'string',
			description: 'Channel slug to filter by (can be used multiple times)',
			multiple: true,
			required: true
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

		const tracks = await listTracks({
			channelSlugs,
			limit: input.limit
		})

		// For text format, return formatted summary
		if (format === 'text') {
			return {
				data: formatTrackSummary(tracks, input.limit),
				format: 'text'
			}
		}

		// For json/sql, return raw data
		return {
			data: tracks,
			format: format,
			formatOptions: format === 'sql' ? {table: 'tracks'} : undefined
		}
	},

	examples: [
		'r4 track list --channel ko002',
		'r4 track list --channel ko002 --limit 20',
		'r4 track list --channel ko002 --format json',
		'r4 track list --channel ko002 --format sql',
		'r4 track list --channel ko002 --channel oskar'
	]
}
