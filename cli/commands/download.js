import {mkdir} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {load as loadConfig} from '../lib/config.js'
import {getChannel, listTracks} from '../lib/data.js'
import {
	downloadChannel as downloadYouTube,
	writeChannelAbout,
	writeChannelImageUrl,
	writeTracksPlaylist
} from '../lib/download.js'
import {downloadChannel as downloadSoulseek} from '../lib/soulseek.js'
import {parse} from '../utils.js'

export default {
	description: 'Download all tracks from a channel',

	options: {
		output: {
			type: 'string',
			description: 'Output folder path (defaults to config.downloadsDir/<slug>)'
		},
		source: {
			type: 'string',
			default: 'youtube',
			description: 'Download source: youtube or soulseek'
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
			description:
				'Number of concurrent downloads (youtube: 1-10, soulseek: 1-3)'
		},
		// Soulseek-specific options
		'slskd-host': {type: 'string', description: 'slskd host'},
		'slskd-port': {type: 'number', description: 'slskd port'},
		'min-bitrate': {
			type: 'number',
			description: 'Minimum bitrate for lossy formats (default: 320)'
		},
		'slskd-downloads-dir': {
			type: 'string',
			description: 'slskd downloads directory (for Docker)'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)

		const slug = positionals[0]
		if (!slug) throw new Error('Missing channel slug')

		const source = values.source
		if (source !== 'youtube' && source !== 'soulseek') {
			throw new Error(`Invalid source: ${source}. Use 'youtube' or 'soulseek'`)
		}

		// Resolve output path from config
		const config = await loadConfig()
		const baseDir = values.output || config.downloadsDir || '.'
		const folderPath = resolve(join(baseDir, slug))

		const dryRun = values['dry-run']
		const verbose = values.verbose
		const noMetadata = values['no-metadata']

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug], limit: values.limit})

		console.log(`${channel.name} (@${channel.slug})`)
		console.log(`Source: ${source}`)
		if (dryRun) console.log(folderPath)
		console.log()

		// Write metadata files
		if (!dryRun) {
			await mkdir(folderPath, {recursive: true})
			if (!noMetadata) {
				console.log(`${folderPath}/`)
				await writeChannelAbout(channel, tracks, folderPath, {verbose})
				console.log(`├── ${channel.slug}.txt`)
				await writeChannelImageUrl(channel, folderPath, {verbose})
				console.log('├── image.url')
				await writeTracksPlaylist(tracks, folderPath, {verbose})
				console.log(`└── tracks.m3u (try: mpv ${folderPath}/tracks.m3u)`)
				console.log()
			}
		}

		// Download via source
		if (source === 'soulseek') {
			// Build slskdConfig by merging CLI options with config.soulseek
			const slskdDownloadsDir =
				values['slskd-downloads-dir'] ??
				(config.downloadsDir ? join(config.downloadsDir, 'slskd') : null)
			const slskdConfig = {
				...config.soulseek,
				host: values['slskd-host'] ?? config.soulseek.host,
				port: values['slskd-port'] ?? config.soulseek.port,
				downloadsDir: slskdDownloadsDir
			}
			await downloadSoulseek(tracks, folderPath, {
				dryRun,
				verbose,
				force: values.force,
				retryFailed: values['retry-failed'],
				concurrency: Math.min(values.concurrency, 3),
				minBitrate: values['min-bitrate'],
				slskdConfig
			})
			return ''
		}

		// YouTube via yt-dlp
		const result = await downloadYouTube(tracks, folderPath, {
			force: values.force,
			retryFailed: values['retry-failed'],
			dryRun,
			verbose,
			writeMetadata: !noMetadata,
			concurrency: values.concurrency
		})

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

		return ''
	},

	examples: [
		'# YouTube (default)',
		'r4 download ko002',
		'r4 download ko002 --limit 10 --dry-run',
		'',
		'# Soulseek (requires slskd)',
		'r4 download ko002 --source soulseek',
		'',
		'# Output: ko002/tracks/ (youtube), ko002/soulseek/ (soulseek)'
	]
}
