import {resolve} from 'node:path'
import {sdk} from '@radio4000/sdk'
import {
	getChannel,
	listTracks,
	requireAuth,
	setPlaybackErrors
} from '../lib/data.js'
import {
	downloadChannel,
	findBrokenTracks,
	prepareTracks,
	readFailures,
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
		'mark-broken': {
			type: 'boolean',
			default: false,
			description:
				'Mark tracks whose video is gone (deleted, private, taken down) as broken, so they show up in doctor. Your own channels only'
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
		'cookies-from-browser': {
			type: 'string',
			description:
				'Log in to YouTube with cookies from a browser (e.g. chrome, firefox). With Premium you get 256kbps'
		},
		upgrade: {
			type: 'boolean',
			default: false,
			description:
				'Replace existing ~128kbps tracks with 256kbps where YouTube has it. Needs --cookies-from-browser and Premium'
		},
		recheck: {
			type: 'boolean',
			default: false,
			description:
				'With --upgrade, also retry tracks that had no better format in the last 6 months'
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
		const markBroken = values['mark-broken']

		if (values.upgrade && !dryRun && !values['cookies-from-browser']) {
			throw new Error(
				'--upgrade needs --cookies-from-browser, 256kbps is only for YouTube Premium'
			)
		}
		if (values.upgrade && values.force) {
			throw new Error('Use either --upgrade or --force, not both')
		}

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug], limit: values.limit})

		// Check ownership before a long download, not after
		if (markBroken && !dryRun) {
			const loginFirst = new Error(
				'To mark broken tracks on your radio, run `r4 auth login` first'
			)
			await requireAuth().catch(() => {
				throw loginFirst
			})
			const {data: owned, error} = await sdk.channels.readUserChannels()
			// An expired session comes back as "User not found"
			if (error?.message === 'User not found') throw loginFirst
			if (error) throw error
			if (!owned.some((ch) => ch.id === channel.id)) {
				throw new Error(
					`--mark-broken only works on your own channels, and @${slug} isn't yours`
				)
			}
		}

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
			console.log('└── download.json')
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
				console.log('└── download.json')
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
			concurrency: values.concurrency,
			cookiesFromBrowser: values['cookies-from-browser'],
			upgrade: values.upgrade,
			recheck: values.recheck
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
			const u = result.upgrade
			if (u?.checked || u?.checkedRecently) {
				console.log(`  Upgrade checked: ${u.checked}`)
				console.log(`    Upgraded: ${u.upgraded}`)
				console.log(`    Already 256kbps: ${u.best}`)
				console.log(`    No better format: ${u.noBetter}`)
				if (u.checkedRecently) {
					console.log(
						`    No better format, checked recently (skipped): ${u.checkedRecently}`
					)
				}
				if (u.unknown)
					console.log(`    Unknown bitrate (skipped): ${u.unknown}`)
				if (u.failed) console.log(`    Upgrade failed: ${u.failed}`)
				if (u.stopped) console.log(`    Stopped: ${u.stopped}`)
			}

			if (result.failures.length > 0) {
				console.log()
				console.log(`⚠ ${result.failed} tracks failed to download`)
				console.log(`  See: ${folderPath}/failures.jsonl`)
			}
		}

		// Reads the whole failures file, so earlier runs count too
		if (markBroken) {
			const broken = findBrokenTracks(
				prepareTracks(tracks, folderPath),
				readFailures(folderPath)
			)
			console.log()
			if (dryRun) {
				console.log(`Would mark broken: ${broken.length}`)
			} else {
				await setPlaybackErrors(
					broken.map(({track, playback_error}) => ({
						id: track.id,
						playback_error
					}))
				)
				console.log(`Marked broken: ${broken.length}`)
				if (broken.length > 0) {
					console.log(`  Fix them: https://radio4000.com/${slug}/doctor`)
				}
			}
			if (verbose) {
				for (const {track, playback_error} of broken) {
					console.log(`  ${playback_error}  ${track.title}`)
				}
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
		'r4 download ko002 --mark-broken',
		'r4 download ko002 --mark-broken --dry-run --verbose',
		'r4 download ko002 --no-metadata',
		'r4 download ko002 --concurrency 5',
		'r4 download ko002 --cookies-from-browser chrome',
		'r4 download ko002 --cookies-from-browser chrome --upgrade',
		'r4 download ko002 --backup-file',
		'r4 download ko002 --backup-file --base-url https://cdn.example.com',
		'mpv ko002/tracks.m3u'
	]
}
