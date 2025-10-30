import {searchAll, searchChannels, searchTracks} from '../lib/data.js'

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
			alias: 'c',
			type: 'boolean',
			description: 'Search only channels',
			default: false
		},
		tracks: {
			alias: 't',
			type: 'boolean',
			description: 'Search only tracks',
			default: false
		},
		limit: {
			type: 'number',
			description: 'Limit number of results per category (default: 10)',
			default: 10
		},
		json: {
			type: 'boolean',
			description: 'Output as JSON',
			default: false
		}
	},
	examples: [
		'r4 search ambient',
		'r4 search ambient --channels',
		'r4 search ko002 --channels --limit 5',
		'r4 search "electronic music" --tracks',
		'r4 search ambient --json'
	],
	async handler(input) {
		const query = input.query
		const {channels, tracks, limit, json} = input

		// Validate: can't specify both channels and tracks
		if (channels && tracks) {
			throw new Error('Cannot specify both --channels and --tracks')
		}

		const options = {limit: limit ?? 10}

		try {
			let results
			let channelCount = 0
			let trackCount = 0

			if (channels) {
				// Search only channels
				results = await searchChannels(query, options)
				channelCount = results?.length ?? 0

				// Handle empty results
				if (channelCount === 0) {
					return `No channels found for "${query}"`
				}

				// Return formatted output
				if (json) {
					return JSON.stringify(results, null, 2)
				}

				const formatted = results
					.map((ch) => `${ch.slug}\t${ch.name || 'Untitled'}`)
					.join('\n')
				return `Found ${channelCount} channel${channelCount !== 1 ? 's' : ''}:\n${formatted}`
			} else if (tracks) {
				// Search only tracks
				results = await searchTracks(query, options)
				trackCount = results?.length ?? 0

				// Handle empty results
				if (trackCount === 0) {
					return `No tracks found for "${query}"`
				}

				// Return formatted output
				if (json) {
					return JSON.stringify(results, null, 2)
				}

				const formatted = results
					.map((t) => `${t.title || 'Untitled'}\t${t.url}`)
					.join('\n')
				return `Found ${trackCount} track${trackCount !== 1 ? 's' : ''}:\n${formatted}`
			} else {
				// Search both (default behavior)
				results = await searchAll(query, options)
				channelCount = results?.channels?.length ?? 0
				trackCount = results?.tracks?.length ?? 0

				// Handle empty results
				if (channelCount === 0 && trackCount === 0) {
					return `No results found for "${query}"`
				}

				// Return formatted output
				if (json) {
					return JSON.stringify(results, null, 2)
				}

				const parts = []

				if (channelCount > 0) {
					const formatted = results.channels
						.map((ch) => `${ch.slug}\t${ch.name || 'Untitled'}`)
						.join('\n')
					parts.push(`Channels (${channelCount}):\n${formatted}`)
				}

				if (trackCount > 0) {
					const formatted = results.tracks
						.map((t) => `${t.title || 'Untitled'}\t${t.url}`)
						.join('\n')
					parts.push(`Tracks (${trackCount}):\n${formatted}`)
				}

				return parts.join('\n\n')
			}
		} catch (error) {
			throw new Error(`Search failed: ${error.message}`)
		}
	}
}
