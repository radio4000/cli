import {resolve} from 'node:path'
import {getChannel, listTracks} from '../lib/data.js'
import {
	downloadChannel,
	prepareTracks,
	writeBackupJson,
	writeChannelAbout,
	writeChannelImageUrl,
	writeTracksPlaylist
} from '../lib/download.js'
import {parse} from '../utils.js'

export default {
	description: 'Download all tracks from a channel',

	options: {
		output: {
			type: 'string',
			description: 'Output folder path (defaults to ./<slug>)'
		},
		limit: {
			type: 'number',
			description: 'Limit number of tracks to download'
		},
		force: {
			type: 'boolean',
			default: false,
			description: 'Re-download existing files'
		},
		'retry-failed': {
			type: 'boolean',
			default: false,
			description: 'Retry previously failed downloads'
		},
		'dry-run': {
			type: 'boolean',
			default: false,
			description: 'Show what would be downloaded without downloading'
		},
		verbose: {
			type: 'boolean',
			default: false,
			description: 'Show detailed output'
		},
		'no-metadata': {
			type: 'boolean',
			default: false,
			description: 'Skip writing metadata files'
		},
		concurrency: {
			type: 'number',
			default: 3,
			description: 'Number of concurrent downloads'
		},
		'base-url': {
			type: 'string',
			description:
				'Base URL for track paths in backup.json (e.g. https://cdn.example.com)'
		},
		'backup-file': {
			type: 'boolean',
			default: false,
			description:
				'Skip downloading, only write backup.json from existing local files'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)

		const slug = positionals[0]
		if (!slug) {
			throw new Error('Missing channel slug')
		}

		const folderPath = resolve(values.output || `./${slug}`)
		const dryRun = values['dry-run']
		const verbose = values.verbose
		const noMetadata = values['no-metadata']
		const backupFile = values['backup-file']

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug], limit: values.limit})

		console.log(`${channel.name} (@${channel.slug})`)
		if (dryRun) {
			console.log(folderPath)
		}
		console.log()

		// --backup-file: skip downloading, just write backup.json from local files
		if (backupFile) {
			const prepared = prepareTracks(tracks, folderPath)
			await writeBackupJson(channel, prepared, folderPath, {
				verbose,
				baseUrl: values['base-url']
			})
			console.log(`${folderPath}/`)
			console.log('└── backup.json')
			return ''
		}

		// Write channel context files (unless dry run)
		if (!dryRun) {
			const {mkdir} = await import('node:fs/promises')
			await mkdir(folderPath, {recursive: true})

			console.log(`${folderPath}/`)
			await writeChannelAbout(channel, tracks, folderPath, {verbose})
			console.log(`├── ${channel.slug}.txt`)
			await writeChannelImageUrl(channel, folderPath, {verbose})
			console.log('├── image.url')
			await writeTracksPlaylist(tracks, folderPath, {verbose})
			if (noMetadata) {
				console.log(`└── tracks.m3u (try: mpv ${folderPath}/tracks.m3u)`)
			} else {
				console.log(`├── tracks.m3u (try: mpv ${folderPath}/tracks.m3u)`)
				console.log('└── backup.json')
			}
			console.log()
		}

		// Download
		const result = await downloadChannel(tracks, folderPath, {
			force: values.force,
			retryFailed: values['retry-failed'],
			dryRun,
			verbose,
			writeMetadata: !noMetadata,
			concurrency: values.concurrency
		})

		// Write backup.json with local paths (unless dry run or no-metadata)
		if (!dryRun && !noMetadata) {
			await writeBackupJson(channel, result.tracks, folderPath, {
				verbose,
				baseUrl: values['base-url']
			})
		}

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
		return ''
	},

	examples: [
		'r4 download ko002',
		'r4 download ko002 --limit 10',
		'r4 download ko002 --output ./my-music',
		'r4 download ko002 --dry-run',
		'r4 download ko002 --force',
		'r4 download ko002 --retry-failed',
		'r4 download ko002 --no-metadata',
		'r4 download ko002 --concurrency 5',
		'r4 download ko002 --backup-file',
		'r4 download ko002 --backup-file --base-url https://cdn.example.com',
		'mpv ko002/tracks.m3u'
	]
}
