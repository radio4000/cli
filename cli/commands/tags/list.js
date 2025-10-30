import {getChannel, listTracks} from '../../lib/data.js'
import {getUniqueTags} from '../../lib/tags.js'

export default {
	description: 'List all tags from a channel',

	args: [
		{
			name: 'slug',
			description: 'Channel slug to list tags from',
			required: true
		}
	],

	options: {
		sorted: {
			type: 'boolean',
			description: 'Sort by occurrence count (most used first)',
			default: false
		},
		limit: {
			type: 'number',
			description: 'Limit number of tags to show'
		},
		'min-count': {
			type: 'number',
			description: 'Only show tags used at least this many times',
			default: 1
		},
		format: {
			type: 'string',
			description: 'Output format: text (default), json, or counts'
		}
	},

	handler: async (input) => {
		const {slug} = input
		const sorted = input.sorted
		const limit = input.limit
		const minCount = input['min-count'] || 1
		const format = input.format || 'text'

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug]})

		// Extract tags
		const {tags, sortedTags, tagMap} = getUniqueTags(tracks)

		if (tags.length === 0) {
			return `No tags found in channel: ${channel.name} (@${slug})`
		}

		// Choose which list to use
		let tagList = sorted
			? sortedTags
			: tags.map((tag) => [tag, tagMap.get(tag)])

		// Filter by minimum count
		if (minCount > 1) {
			tagList = tagList.filter((item) => {
				const count = Array.isArray(item) ? item[1] : tagMap.get(item)
				return count >= minCount
			})
		}

		// Apply limit
		if (limit && limit > 0) {
			tagList = tagList.slice(0, limit)
		}

		// Output based on format
		if (format === 'json') {
			const jsonData = tagList.map((item) => {
				if (Array.isArray(item)) {
					return {tag: item[0], count: item[1]}
				}
				return {tag: item, count: tagMap.get(item)}
			})
			return JSON.stringify(jsonData, null, 2)
		}

		// Text formats
		const lines = [`Tags in ${channel.name} (@${slug}):\n`]

		if (format === 'counts' || sorted) {
			// Show counts
			for (const item of tagList) {
				const [tag, count] = Array.isArray(item)
					? item
					: [item, tagMap.get(item)]
				lines.push(`${count.toString().padStart(3, ' ')}  ${tag}`)
			}
		} else {
			// Just tags, alphabetically
			for (const item of tagList) {
				const tag = Array.isArray(item) ? item[0] : item
				lines.push(tag)
			}
		}

		return lines.join('\n')
	},

	examples: [
		'r4 tags list ko002',
		'r4 tags list ko002 --sorted',
		'r4 tags list ko002 --sorted --limit 10',
		'r4 tags list ko002 --min-count 5',
		'r4 tags list ko002 --format json',
		'r4 tags list ko002 --format counts'
	]
}
