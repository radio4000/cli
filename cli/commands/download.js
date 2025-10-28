import {getChannel, listTracks} from '../lib/data.js'
import {
	downloadChannel,
	writeChannelAbout,
	writeChannelImageUrl,
	writeTracksPlaylist
} from '../lib/download.js'

export default {
	description: 'Download all tracks from a channel',

	args: [
		{
			name: 'slug',
			description: 'Channel slug to download',
			required: true
		}
	],

	options: {
		output: {
			type: 'string',
			description: 'Download folder path (defaults to ./downloads/<slug>)'
		},
		limit: {
			type: 'number',
			description: 'Limit number of tracks to download'
		},
		force: {
			type: 'boolean',
			description: 'Re-download existing files',
			default: false
		},
		dryRun: {
			type: 'boolean',
			description: 'Show what would be downloaded without downloading',
			default: false
		},
		debug: {
			type: 'boolean',
			description: 'Show detailed debug output',
			default: false
		},
		noMetadata: {
			type: 'boolean',
			description: 'Skip writing metadata to files',
			default: false
		}
	},

	handler: async (input) => {
		const {slug} = input
		const folderPath = input.output || `./downloads/${slug}`

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug], limit: input.limit})

		console.log(`Channel: ${channel.name} (@${channel.slug})`)
		console.log()

		// Write channel context files (unless dry run)
		if (!input.dryRun) {
			const {mkdir} = await import('node:fs/promises')
			await mkdir(folderPath, {recursive: true})

			console.log(`${folderPath}/`)
			await writeChannelAbout(channel, tracks, folderPath, {debug: input.debug})
			console.log('├── ABOUT.txt')
			await writeChannelImageUrl(channel, folderPath, {debug: input.debug})
			console.log('├── image.url')
			await writeTracksPlaylist(tracks, folderPath, {debug: input.debug})
			console.log(`└── tracks.m3u (try: mpv ${folderPath}/tracks.m3u)`)
			console.log()
		}

		// Download
		const result = await downloadChannel(tracks, folderPath, {
			force: input.force,
			dryRun: input.dryRun,
			debug: input.debug,
			writeMetadata: !input.noMetadata
		})

		console.log()
		console.log('Summary:')
		console.log(`  Total: ${result.total}`)
		console.log(`  Downloaded: ${result.downloaded}`)
		console.log(`  Already exists: ${result.existing}`)
		console.log(`  Unavailable: ${result.unavailable}`)
		console.log(`  Failed: ${result.failed}`)

		if (result.failures.length > 0) {
			console.log()
			console.log('Failures:')
			for (const failure of result.failures) {
				console.log(`  ${failure.track.title}`)
				console.log(`    ${failure.error}`)
			}
		}

		return {
			data: result,
			format: 'json'
		}
	},

	examples: [
		'r4 download ko002',
		'r4 download ko002 --limit 10',
		'r4 download ko002 --output ./my-music',
		'r4 download ko002 --dry-run',
		'r4 download ko002 --force',
		'r4 download ko002 --no-metadata'
	]
}
