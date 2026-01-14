import {existsSync} from 'node:fs'
import {mkdir} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {load as loadConfig} from '../lib/config.js'
import {getChannel, listTracks} from '../lib/data.js'
import {
	downloadChannel,
	writeChannelAbout,
	writeChannelImageUrl,
	writeTracksPlaylist
} from '../lib/download.js'
import {toFilename} from '../lib/filenames.js'
import {
	createClient as createSoulseekClient,
	downloadTracks as downloadSoulseekTracks
} from '../lib/soulseek.js'
import {parse} from '../utils.js'

export default {
	description: 'Download all tracks from a channel',

	options: {
		output: {
			type: 'string',
			description: 'Output folder path (defaults to ./<slug>)'
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
		'slskd-host': {
			type: 'string',
			default: 'localhost',
			description: 'slskd host (default: localhost)'
		},
		'slskd-port': {
			type: 'number',
			default: 5030,
			description: 'slskd port (default: 5030)'
		},
		'min-bitrate': {
			type: 'number',
			default: 320,
			description: 'Minimum bitrate for lossy formats (soulseek only)'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)

		const slug = positionals[0]
		if (!slug) {
			throw new Error('Missing channel slug')
		}

		const source = values.source
		if (source !== 'youtube' && source !== 'soulseek') {
			throw new Error(`Invalid source: ${source}. Use 'youtube' or 'soulseek'`)
		}

		const folderPath = resolve(values.output || `./${slug}`)
		const dryRun = values['dry-run']
		const verbose = values.verbose
		const noMetadata = values['no-metadata']

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug], limit: values.limit})

		console.log(`${channel.name} (@${channel.slug})`)
		console.log(`Source: ${source}`)
		if (dryRun) {
			console.log(folderPath)
		}
		console.log()

		// Write channel context files (unless dry run)
		if (!dryRun) {
			await mkdir(folderPath, {recursive: true})

			console.log(`${folderPath}/`)
			await writeChannelAbout(channel, tracks, folderPath, {verbose})
			console.log(`├── ${channel.slug}.txt`)
			await writeChannelImageUrl(channel, folderPath, {verbose})
			console.log('├── image.url')
			await writeTracksPlaylist(tracks, folderPath, {verbose})
			console.log(`└── tracks.m3u (try: mpv ${folderPath}/tracks.m3u)`)
			console.log()
		}

		// Branch based on source
		if (source === 'soulseek') {
			return downloadFromSoulseek(tracks, folderPath, {
				dryRun,
				verbose,
				force: values.force,
				concurrency: Math.min(values.concurrency, 3), // Soulseek is slower, limit concurrency
				host: values['slskd-host'],
				port: values['slskd-port'],
				minBitrate: values['min-bitrate']
			})
		}

		// Default: YouTube via yt-dlp
		const result = await downloadChannel(tracks, folderPath, {
			force: values.force,
			retryFailed: values['retry-failed'],
			dryRun,
			verbose,
			writeMetadata: !noMetadata,
			concurrency: values.concurrency
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
		return ''
	},

	examples: [
		'r4 download ko002',
		'r4 download ko002 --source soulseek',
		'r4 download ko002 --limit 10',
		'r4 download ko002 --output ./my-music',
		'r4 download ko002 --dry-run',
		'r4 download ko002 --force',
		'r4 download ko002 --retry-failed',
		'r4 download ko002 --no-metadata',
		'r4 download ko002 --concurrency 5',
		'r4 download ko002 --source soulseek --min-bitrate 256',
		'mpv ko002/tracks.m3u'
	]
}

/**
 * Download tracks from Soulseek via slskd
 */
async function downloadFromSoulseek(tracks, folderPath, options = {}) {
	const {
		dryRun = false,
		verbose = false,
		force = false,
		concurrency = 2,
		host = 'localhost',
		port = 5030,
		minBitrate = 320
	} = options

	// Load config for slskd credentials
	const config = await loadConfig()
	const slskdConfig = {
		host,
		port,
		...config.soulseek
	}

	// Create client and verify connection
	const client = createSoulseekClient(slskdConfig)

	if (!dryRun) {
		console.log(`Connecting to slskd at ${host}:${port}...`)
		try {
			await client.checkConnection()
			console.log('Connected to slskd')
			console.log()
		} catch (error) {
			console.error(`Failed to connect to slskd: ${error.message}`)
			console.error()
			console.error('Make sure slskd is running:')
			console.error('  docker run -d -p 5030:5030 -p 5031:5031 slskd/slskd')
			console.error()
			console.error(
				'Or configure connection in ~/.config/radio4000/config.json:'
			)
			console.error('  { "soulseek": { "host": "localhost", "port": 5030 } }')
			throw error
		}
	}

	// Filter tracks that already exist
	const tracksDir = join(folderPath, 'tracks')
	const toDownload = force
		? tracks
		: tracks.filter((track) => {
				// Check if any file matching this track exists
				const baseFilename = toFilename(track, {source: 'soulseek'})
				// Check common extensions
				for (const ext of ['flac', 'mp3', 'wav', 'ogg', 'm4a']) {
					if (existsSync(join(tracksDir, `${baseFilename}.${ext}`))) {
						return false
					}
				}
				return true
			})

	const existing = tracks.length - toDownload.length

	console.log(`Total tracks: ${tracks.length}`)
	console.log(`  Already exists: ${existing}`)
	console.log(`  To download: ${toDownload.length}`)
	console.log(`  Concurrency: ${concurrency}`)
	console.log(`  Min bitrate: ${minBitrate}kbps (or lossless)`)
	console.log()

	if (dryRun) {
		console.log('Would search and download:')
		for (const track of toDownload.slice(0, 5)) {
			console.log(`  ${track.title}`)
		}
		if (toDownload.length > 5) {
			console.log(`  [...${toDownload.length - 5} more]`)
		}
		return ''
	}

	if (toDownload.length === 0) {
		console.log('Nothing to download.')
		return ''
	}

	// Download tracks
	const results = await downloadSoulseekTracks(client, toDownload, folderPath, {
		concurrency,
		verbose,
		minBitrate
	})

	// Summary
	console.log()
	console.log('Summary:')
	console.log(`  Total: ${tracks.length}`)
	console.log(`  Downloaded: ${results.complete.length}`)
	console.log(`  Already exists: ${existing}`)
	console.log(`  No match found: ${results.no_match.length}`)
	console.log(`  Failed: ${results.failed.length}`)

	if (results.no_match.length > 0) {
		console.log()
		console.log(
			`⚠ ${results.no_match.length} tracks had no matches on Soulseek`
		)
		if (verbose) {
			for (const track of results.no_match.slice(0, 5)) {
				console.log(`  - ${track.title}`)
			}
			if (results.no_match.length > 5) {
				console.log(`  [...${results.no_match.length - 5} more]`)
			}
		}
	}

	if (results.failed.length > 0) {
		console.log()
		console.log(`⚠ ${results.failed.length} tracks failed to download`)
		if (verbose) {
			for (const {track, error} of results.failed.slice(0, 5)) {
				console.log(`  - ${track.title}: ${error}`)
			}
		}
	}

	return ''
}
