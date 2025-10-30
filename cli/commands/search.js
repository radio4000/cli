import {searchAll, searchChannels, searchTracks} from '../lib/data.js'

// Pure formatters
const formatChannel = (ch) => `${ch.slug}\t${ch.name || 'Untitled'}`
const formatTrack = (t) => `${t.title || 'Untitled'}\t${t.url}`
const plural = (count, word) => `${count} ${word}${count !== 1 ? 's' : ''}`

// Build single-type results message
const buildMessage = (items, formatter, label) => {
	const formatted = items.map(formatter).join('\n')
	return `Found ${plural(items.length, label)}:\n${formatted}`
}

// Build combined results message
const buildCombinedMessage = (channels, tracks) => {
	const parts = []
	if (channels?.length > 0) {
		const formatted = channels.map(formatChannel).join('\n')
		parts.push(`Channels (${channels.length}):\n${formatted}`)
	}
	if (tracks?.length > 0) {
		const formatted = tracks.map(formatTrack).join('\n')
		parts.push(`Tracks (${tracks.length}):\n${formatted}`)
	}
	return parts.join('\n\n')
}

export default {
	description: 'Search channels and tracks',
	args: [
		{
			name: 'query',
			required: true,
			description: 'Search query'
		}
	],
	options: {
		channels: {
			type: 'boolean',
			description: 'Search only channels',
			default: false
		},
		tracks: {
			type: 'boolean',
			description: 'Search only tracks',
			default: false
		},
		limit: {
			type: 'number',
			description: 'Limit number of results per category (default: 10)',
			default: 10
		},
		format: {
			type: 'string',
			description: 'Output format: text (default) or json',
			default: 'text'
		}
	},
	examples: [
		'r4 search ambient',
		'r4 search ambient --channels',
		'r4 search ko002 --channels --limit 5',
		'r4 search "electronic music" --tracks',
		'r4 search ambient --format json'
	],
	async handler(input) {
		const {query, channels, tracks, limit = 10, format = 'text'} = input

		if (channels && tracks) {
			throw new Error('Cannot specify both --channels and --tracks')
		}

		const options = {limit}

		// Search channels only
		if (channels) {
			const results = await searchChannels(query, options)
			if (results.length === 0) return `No channels found for "${query}"`
			return format === 'json'
				? JSON.stringify(results, null, 2)
				: buildMessage(results, formatChannel, 'channel')
		}

		// Search tracks only
		if (tracks) {
			const results = await searchTracks(query, options)
			if (results.length === 0) return `No tracks found for "${query}"`
			return format === 'json'
				? JSON.stringify(results, null, 2)
				: buildMessage(results, formatTrack, 'track')
		}

		// Search both
		const results = await searchAll(query, options)
		const {channels: chs = [], tracks: trks = []} = results

		if (chs.length === 0 && trks.length === 0) {
			return `No results found for "${query}"`
		}

		return format === 'json'
			? JSON.stringify(results, null, 2)
			: buildCombinedMessage(chs, trks)
	}
}
