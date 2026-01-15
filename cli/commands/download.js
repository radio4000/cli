import {existsSync} from 'node:fs'
import {mkdir} from 'node:fs/promises'
import {join, resolve} from 'node:path'
import {load as loadConfig} from '../lib/config.js'
import {getChannel, listTracks} from '../lib/data.js'
import {
	downloadChannel,
	readFailedTrackIds,
	writeChannelAbout,
	writeChannelImageUrl,
	writeFailures,
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
		// Soulseek-specific options (defaults come from config, then fallback)
		'slskd-host': {
			type: 'string',
			description: 'slskd host (default: from config or localhost)'
		},
		'slskd-port': {
			type: 'number',
			description: 'slskd port (default: from config or 5030)'
		},
		'min-bitrate': {
			type: 'number',
			description: 'Minimum bitrate for lossy formats (default: 320)'
		},
		'slskd-downloads-dir': {
			type: 'string',
			description:
				'Override slskd downloads directory (for Docker setups where host path differs)'
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

		// Load config for default paths
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
		if (dryRun) {
			console.log(folderPath)
		}
		console.log()

		// Ensure output folder exists
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

		// Branch based on source
		if (source === 'soulseek') {
			return downloadFromSoulseek(tracks, folderPath, {
				dryRun,
				verbose,
				force: values.force,
				retryFailed: values['retry-failed'],
				concurrency: Math.min(values.concurrency, 3), // Soulseek is slower, limit concurrency
				host: values['slskd-host'],
				port: values['slskd-port'],
				minBitrate: values['min-bitrate'],
				downloadsDir: values['slskd-downloads-dir']
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
		'# YouTube downloads (default)',
		'r4 download ko002',
		'r4 download ko002 --limit 10',
		'r4 download ko002 --output ./my-music',
		'r4 download ko002 --dry-run',
		'',
		'# Soulseek downloads (requires slskd)',
		'# Start slskd: docker run -d --network host -e SLSKD_SLSK_USERNAME=user -e SLSKD_SLSK_PASSWORD=pass -v ~/Music/slskd:/app/downloads slskd/slskd',
		'r4 download ko002 --source soulseek --slskd-downloads-dir ~/Music/slskd',
		'r4 download ko002 --source soulseek --min-bitrate 256',
		'',
		'# Output structure:',
		'#   ko002/tracks/     - YouTube downloads (mp3/opus)',
		'#   ko002/soulseek/   - Soulseek downloads (flac/wav/mp3)',
		'',
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
		retryFailed = false,
		concurrency = 2,
		host,
		port,
		minBitrate = 320,
		downloadsDir
	} = options

	// Load config for slskd credentials (CLI args override config, then defaults)
	const config = await loadConfig()
	// slskd downloads dir: CLI flag > config.downloadsDir/slskd > none (uses slskd API)
	const slskdDownloadsDir =
		downloadsDir ?? (config.downloadsDir ? join(config.downloadsDir, 'slskd') : null)
	const slskdConfig = {
		...config.soulseek,
		host: host ?? config.soulseek?.host ?? 'localhost',
		port: port ?? config.soulseek?.port ?? 5030,
		downloadsDir: slskdDownloadsDir
	}
	const effectiveHost = slskdConfig.host
	const effectivePort = slskdConfig.port

	// Create client and verify connection
	const client = createSoulseekClient(slskdConfig)

	if (!dryRun) {
		console.log(`Connecting to slskd at ${effectiveHost}:${effectivePort}...`)
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
	const soulseekDir = join(folderPath, 'soulseek')
	const failedIds = retryFailed ? new Set() : readFailedTrackIds(folderPath)
	// DJ-compatible formats only (CDJ/Rekordbox/Traktor/Serato)
	const supportedExtensions = ['flac', 'wav', 'mp3', 'ogg']
	const hasExistingFile = (track) => {
		const baseFilename = toFilename(track, {source: 'soulseek'})
		for (const ext of supportedExtensions) {
			if (existsSync(join(soulseekDir, `${baseFilename}.${ext}`))) {
				return true
			}
		}
		return false
	}
	const toDownload = force
		? tracks
		: tracks.filter((track) => {
				if (failedIds.has(track.id)) {
					return false
				}
				return !hasExistingFile(track)
			})

	const existing = tracks.filter((track) => hasExistingFile(track)).length
	const previouslyFailed = tracks.filter((track) =>
		failedIds.has(track.id)
	).length

	console.log(`Total tracks: ${tracks.length}`)
	console.log(`  Already exists: ${existing}`)
	if (previouslyFailed > 0) {
		console.log(`  Previously failed: ${previouslyFailed}`)
	}
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

	if (results.failed.length > 0) {
		await writeFailures(results.failed, folderPath, {verbose})
	}

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
		console.log(`  See: ${folderPath}/failures.jsonl`)
		if (verbose) {
			for (const {track, error} of results.failed.slice(0, 5)) {
				console.log(`  - ${track.title}: ${error}`)
			}
		}
	}

	return ''
}
