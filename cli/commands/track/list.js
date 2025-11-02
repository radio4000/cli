import {listTracks} from '../../lib/data.js'
import {toJSON, trackToSQL} from '../../lib/formatters.js'
import {filterTracksByTags} from '../../lib/tags.js'
import {parse} from '../../utils.js'

function formatTrackSummary(tracks, limit) {
	const totalCount = tracks.length
	const displayLimit = limit || 10
	const displayTracks = tracks.slice(0, displayLimit)

	const lines = []

	if (totalCount > 0) {
		const showing = Math.min(displayLimit, totalCount)
		lines.push(`Showing ${showing} track${showing !== 1 ? 's' : ''}:`)

		displayTracks.forEach((track) => {
			// Format single track inline (title + description + url)
			lines.push(`${track.title}\n${track.description}\n  ${track.url}`)
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

	async run(argv) {
		const {values} = parse(argv, {
			channel: {type: 'string', multiple: true},
			tag: {type: 'string', multiple: true},
			'match-all': {type: 'boolean', default: false},
			limit: {type: 'number'},
			format: {type: 'string'}
		})

		if (!values.channel || values.channel.length === 0) {
			throw new Error('--channel is required')
		}

		const channelSlugs = Array.isArray(values.channel)
			? values.channel
			: [values.channel]

		// Default to text for TTY (human), json when piped (machine)
		const isTTY = Boolean(process.stdout.isTTY)
		const format = values.format || (isTTY ? 'text' : 'json')

		const tags = values.tag
			? Array.isArray(values.tag)
				? values.tag
				: [values.tag]
			: null
		const matchAll = values['match-all'] || false

		// Fetch all tracks from channel(s), don't apply limit yet if filtering by tags
		let tracks = await listTracks({
			channelSlugs,
			limit: tags ? undefined : values.limit
		})

		// Filter by tags if specified
		if (tags && tags.length > 0) {
			tracks = filterTracksByTags(tracks, tags, matchAll)
			// Apply limit after filtering
			if (values.limit) {
				tracks = tracks.slice(0, values.limit)
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
			return formatTrackSummary(tracks, values.limit)
		}
		if (format === 'sql') {
			return trackToSQL(tracks)
		}
		return toJSON(tracks)
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
