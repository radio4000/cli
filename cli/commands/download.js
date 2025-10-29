import {resolve} from 'node:path'
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
		'retry-failed': {
			type: 'boolean',
			description: 'Retry tracks that previously failed (default: skip them)',
			default: false
		},
		'dry-run': {
			type: 'boolean',
			description: 'Show what would be downloaded without downloading',
			default: false
		},
		verbose: {
			type: 'boolean',
			description: 'Show detailed output',
			default: false
		},
		'no-metadata': {
			type: 'boolean',
			description: 'Skip writing metadata to files',
			default: false
		},
		concurrency: {
			type: 'number',
			description: 'Number of concurrent downloads (1-10, default: 3)',
			default: 3
		}
	},

	handler: async (input) => {
		const {slug} = input
		const folderPath = resolve(input.output || `./${slug}`)
		const dryRun = input['dry-run']
		const verbose = input.verbose
		const noMetadata = input['no-metadata']

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug], limit: input.limit})

		console.log(`${channel.name} (@${channel.slug})`)
		if (dryRun) {
			console.log(folderPath)
		}
		console.log()

		// Write channel context files (unless dry run)
		if (!dryRun) {
			const {mkdir} = await import('node:fs/promises')
			await mkdir(folderPath, {recursive: true})

			console.log(`${folderPath}/`)
			await writeChannelAbout(channel, tracks, folderPath, {verbose})
			console.log('├── ABOUT.txt')
			await writeChannelImageUrl(channel, folderPath, {verbose})
			console.log('├── image.url')
			await writeTracksPlaylist(tracks, folderPath, {verbose})
			console.log(`└── tracks.m3u (try: mpv ${folderPath}/tracks.m3u)`)
			console.log()
		}

		// Download
		const result = await downloadChannel(tracks, folderPath, {
			force: input.force,
			retryFailed: input['retry-failed'],
			dryRun,
			verbose,
			writeMetadata: !noMetadata,
			concurrency: input.concurrency
		})

		// Only show summary and failures for actual downloads, not dry runs
		if (!dryRun) {
			console.log()
			console.log('Summary:')
			console.log(`  Total: ${result.total}`)
			console.log(`  Downloaded: ${result.downloaded}`)
			console.log(`  Already exists: ${result.existing}`)
			console.log(`  Unavailable: ${result.unavailable}`)
			if (result.previouslyFailed > 0) {
				console.log(`  Previously failed (skipped): ${result.previouslyFailed}`)
			}
			console.log(`  Failed: ${result.failed}`)

			if (result.failures.length > 0) {
				console.log()
				console.log(`⚠ ${result.failed} tracks failed to download`)
				console.log(`  See: ${folderPath}/failures.jsonl`)
			}
		}

		// Don't return data - all output already printed above
		return {
			data: '',
			format: 'text'
		}
	},

	examples: [
		'r4 download ko002',
		'r4 download ko002 --limit 10',
		'r4 download ko002 --output ./my-music',
		'r4 download ko002 --dry-run',
		'r4 download ko002 --force',
		'r4 download ko002 --retry-failed',
		'r4 download ko002 --no-metadata',
		'r4 download ko002 --concurrency 5'
	]
}
