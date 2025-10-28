#!/usr/bin/env bun

// Note, this CLI only works in bun for now.

import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'
import {downloadChannel} from './r5/download.js'
import {r5} from './r5/index.js'
import type {Channel, Track} from './types.ts'

// Source handlers
const sources = {
	channels: {local: r5.channels.local, r4: r5.channels.r4, v1: r5.channels.v1},
	tracks: {local: r5.tracks.local, r4: r5.tracks.r4, v1: r5.tracks.v1}
}

// Error handlers
/** @param {Error} error @param {number} [code=3] */
const handleError = (error, code = 3) => {
	console.error('Error:', error.message)
	process.exit(code)
}

/** @param {Error} error @param {string} context @param {number} [code=3] */
const handleSourceError = (error, context, code = 3) => {
	if (error.message.includes('JSON object requested')) {
		console.error(`${context} not found`)
		process.exit(1)
	}
	handleError(error, code)
}

// Output formatters
/** @param {{slug: string; name?: string}} channel */
const formatChannel = (channel) => `${channel.slug}\t${channel.name || 'Untitled'}`
/** @param {{title?: string; url: string}} track */
const formatTrack = (track) => `${track.title || 'Untitled'}\t${track.url}`

/**
 * @template T
 * @param {T[]} results
 * @param {(item: T) => string} formatter
 * @param {boolean} json
 * @param {number} [limit]
 */
const outputResults = (results, formatter, json, limit) => {
	const display = limit ? results.slice(0, limit) : results

	if (json) {
		process.stdout.write(JSON.stringify(display, null, 2))
		process.stdout.write('\n')
	} else {
		if (limit && results.length > limit) {
			for (const item of display) {
				console.log(formatter(item))
			}
			console.log(`... and ${results.length - limit} more`)
		} else {
			for (const item of display) {
				console.log(formatter(item))
			}
		}
	}
}

const cli = yargs(hideBin(process.argv))
	.scriptName('r5')
	.version('1.0.0')
	.help('help')
	.alias('help', 'h')
	.usage(
		`R5. A Radio4000 experiment

Usage:
  $0 search <query> [--channels|--tracks] [--json]
  $0 tags <slug> [--json] [--limit=<n>]               # Show hashtag statistics
  $0 pull <slug> [--dry-run]                          # Smart sync (local->r4->v1) both channel+tracks
  $0 channels list [slug] [--source=<src>] [--json]   # Explicit source query
  $0 channels pull [slug] [--dry-run]                 # Force remote pull
  $0 tracks list [slug] [--source=<src>] [--json]     # Explicit source query  
  $0 tracks pull <slug> [--dry-run]                   # Force remote pull
  $0 download <slug> [--output=<dir>] [--dry-run]
  $0 db (export|reset|migrate)
  $0 -h | --help
  $0 --version`
	)
	.example('$0 pull ko002', 'Smart sync channel+tracks (local first)')
	.example('$0 search ko002', 'Search everything for "ko002"')
	.example('$0 tags tobha --limit 10', 'Show top 10 hashtags for @tobha')
	.example('$0 tracks list ko002 --source r4 --limit 5', 'List 5 tracks from remote')
	.example('$0 channels list --source local --json', 'Get local channels as JSON')
	.example('$0 channels pull ko002', 'Force pull channel from remote')
	.recommendCommands()
	.strictCommands()
	.demandCommand(1, 'You need at least one command')
	.strict()
	.showHelpOnFail(false)
	.fail((msg, err) => {
		if (msg) {
			console.error(`Error: ${msg}`)
			if (msg.includes('source')) {
				console.error('Try: --source local, --source r4, or --source v1. Data is only local after pulling.')
			}
			process.exit(1)
		}
		if (err) throw err
	})
	.parserConfiguration({
		'short-option-groups': true,
		'populate--': true,
		'halt-at-non-option': false
	})
	.wrap(Math.min(100, process.stdout.columns || 80))

// Channels commands
cli.command('channels <command>', 'Manage channels', (yargs) => {
	return yargs
		.command(
			'list [slug]',
			'List channels',
			(yargs) =>
				yargs
					.positional('slug', {describe: 'Channel slug', type: 'string'})
					.option('source', {
						choices: ['local', 'r4', 'v1'] as const,
						describe: 'Data source: local (your db), r4 (radio4000.com), v1 (legacy)',
						demandOption: true
					})
					.option('limit', {type: 'number', describe: 'Limit number of results'})
					.option('json', {type: 'boolean', default: false, describe: 'Output as JSON'})
					// .demandOption('source', 'COME ONE')
					.group(['source', 'limit', 'json'], 'Options:'),
			async (argv) => {
				try {
					const opts = argv.slug ? {slug: argv.slug, limit: argv.limit} : {limit: argv.limit}
					const results = await sources.channels[argv.source](opts)
					outputResults(results, formatChannel, argv.json, argv.limit)
				} catch (error) {
					handleSourceError(error, `Channel '${argv.slug}'`)
				}
			}
		)
		.command(
			'pull [slug]',
			'Force pull channels from remote (bypasses local)',
			(yargs) =>
				yargs.positional('slug', {describe: 'Specific channel slug to pull', type: 'string'}).option('dry-run', {
					type: 'boolean',
					default: false,
					describe: 'Show what would happen without doing it'
				}),
			async (argv) => {
				try {
					if (argv['dry-run']) {
						console.log(`Would pull channel${argv.slug ? ` '${argv.slug}'` : 's'}`)
						return
					}
					const opts = argv.slug ? {slug: argv.slug} : {}
					const result = await r5.channels.pull(opts)
					if (Array.isArray(result)) {
						console.log(`Pulled ${result.length} channel${result.length === 1 ? '' : 's'}`)
					} else if (result && typeof result === 'object' && 'slug' in result) {
						console.log(`Pulled channel: ${(result as {slug: string}).slug}`)
					} else {
						console.log('Channel pulled successfully')
					}
				} catch (error) {
					handleError(error)
				}
			}
		)
		.demandCommand(1, 'You need to specify a channels command')
})

// Tracks commands
cli.command('tracks <command>', 'Manage tracks', (yargs) => {
	return yargs
		.command(
			'list [slug]',
			'List tracks',
			(yargs) =>
				yargs
					.positional('slug', {describe: 'Channel slug', type: 'string'})
					.option('source', {
						choices: ['local', 'r4', 'v1'] as const,
						describe: 'Data source: local (your db), r4 (radio4000.com), v1 (legacy)',
						demandOption: true
					})
					.option('limit', {type: 'number', describe: 'Limit number of results'})
					.option('json', {type: 'boolean', default: false, describe: 'Output as JSON'})
					.group(['source', 'limit', 'json'], 'Options:'),
			async (argv) => {
				try {
					const opts = argv.slug ? {slug: argv.slug, limit: argv.limit} : {limit: argv.limit}
					const results = await sources.tracks[argv.source](opts)
					outputResults(results, formatTrack, argv.json, argv.limit)
				} catch (error) {
					handleSourceError(error, `Channel '${argv.slug}'`)
				}
			}
		)
		.command(
			'pull <slug>',
			'Force pull tracks from remote (bypasses local)',
			(yargs) =>
				yargs.positional('slug', {describe: 'Channel slug', type: 'string', demandOption: true}).option('dry-run', {
					type: 'boolean',
					default: false,
					describe: 'Show what would happen without doing it'
				}),
			async (argv) => {
				try {
					if (argv['dry-run']) {
						console.log(`Would pull tracks for channel '${argv.slug}'`)
						return
					}
					const result = await r5.tracks.pull({slug: argv.slug})
					if (Array.isArray(result)) {
						console.log(`Pulled ${result.length} track${result.length === 1 ? '' : 's'}`)
					} else {
						console.log('Tracks pulled successfully')
					}
				} catch (error) {
					handleError(error)
				}
			}
		)
		.demandCommand(1, 'You need to specify a tracks command')
})

// Pull command (smart sync: local first, then r4->v1 fallback)
cli.command(
	'pull <slug>',
	'Smart sync channel and tracks (local->r4->v1)',
	(yargs) =>
		yargs.positional('slug', {describe: 'Channel slug', type: 'string', demandOption: true}).option('dry-run', {
			type: 'boolean',
			default: false,
			describe: 'Show what would happen without doing it'
		}),
	async (argv) => {
		try {
			if (argv['dry-run']) {
				console.log(`Would pull channel and tracks for '${argv.slug}'`)
				return
			}
			await r5.pull(argv.slug)
			console.log(`Pulled channel and tracks for '${argv.slug}'`)
		} catch (error) {
			handleError(error)
		}
	}
)

// Search command with optional filters
cli.command(
	'search <query>',
	'Search channels and tracks',
	(yargs) =>
		yargs
			.positional('query', {describe: 'Search query', type: 'string', demandOption: true})
			.option('channels', {
				alias: 'c',
				type: 'boolean',
				describe: 'Search only channels'
			})
			.option('tracks', {
				alias: 't',
				type: 'boolean',
				describe: 'Search only tracks'
			})
			.option('json', {
				type: 'boolean',
				default: false,
				describe: 'Output as JSON'
			})
			.group(['channels', 'tracks', 'json'], 'Options:')
			.check((argv) => {
				if (argv.channels && argv.tracks) {
					throw new Error('Cannot specify both --channels and --tracks')
				}
				return true
			}),
	async (argv) => {
		try {
			const query = argv.query.trim()
			let results: Channel[] | Track[] | {channels: Channel[]; tracks: Track[]}

			if (argv.channels) {
				results = await r5.search.channels(query)
				if (argv.json) {
					process.stdout.write(JSON.stringify(results, null, 2))
					process.stdout.write('\n')
				} else {
					for (const channel of results) {
						console.log(formatChannel(channel))
					}
				}
			} else if (argv.tracks) {
				results = await r5.search.tracks(query)
				if (argv.json) {
					process.stdout.write(JSON.stringify(results, null, 2))
					process.stdout.write('\n')
				} else {
					for (const track of results) {
						console.log(formatTrack(track))
					}
				}
			} else {
				// Search everything
				results = await r5.search.all(query)
				if (argv.json) {
					process.stdout.write(JSON.stringify(results, null, 2))
					process.stdout.write('\n')
				} else {
					if (results.channels?.length) {
						console.log('Channels:')
						for (const channel of results.channels) {
							console.log(`  ${formatChannel(channel)}`)
						}
					}
					if (results.tracks?.length) {
						console.log('Tracks:')
						for (const track of results.tracks) {
							console.log(`  ${formatTrack(track)}`)
						}
					}
				}
			}
		} catch (error) {
			handleError(error)
		}
	}
)

// Tags command - aggregate hashtags from track descriptions
cli.command(
	'tags <slug>',
	'Show hashtag usage statistics for a channel',
	(yargs) =>
		yargs
			.positional('slug', {describe: 'Channel slug', type: 'string', demandOption: true})
			.option('json', {
				type: 'boolean',
				default: false,
				describe: 'Output as JSON'
			})
			.option('limit', {
				type: 'number',
				describe: 'Limit number of tags shown'
			})
			.group(['json', 'limit'], 'Options:'),
	async (argv) => {
		try {
			const results = await r5.tags.local(argv.slug, argv.limit)

			if (results.length === 0) {
				console.log(`No tags found for channel '${argv.slug}'`)
				return
			}

			if (argv.json) {
				process.stdout.write(JSON.stringify(results, null, 2))
				process.stdout.write('\n')
			} else {
				console.log(`Tags for @${argv.slug}:`)
				for (const {tag, count} of results) {
					console.log(`  ${tag.padEnd(30)} ${count}`)
				}
				if (!argv.limit) {
					console.log(`\nTotal: ${results.length} unique tags`)
				}
			}
		} catch (error) {
			handleError(error)
		}
	}
)

// Database commands
const dbCommands: Array<[string, string, () => Promise<void>]> = [
	[
		'export',
		'Export database (browser only)',
		async () => {
			console.log('Database export is only available in the browser interface.')
			console.log('To backup your data, copy the directory: ./cli-db')
		}
	],
	[
		'reset',
		'Reset database',
		async () => {
			await r5.db.reset()
			console.log('Database reset successfully')
		}
	],
	[
		'migrate',
		'Run database migrations',
		async () => {
			await r5.db.migrate()
			console.log('Database migrated successfully')
		}
	]
]

cli.command('db <command>', 'Database operations', (yargs) => {
	dbCommands.forEach(([cmd, desc, handler]) => {
		;(yargs as import('yargs').Argv<Record<string, unknown>>).command(cmd, desc, {}, async () => {
			try {
				await handler()
			} catch (error) {
				handleError(error, 4)
			}
		})
	})
	return yargs.demandCommand(1, 'You need to specify a db command')
})

// Download command
cli.command(
	'download <slug>',
	'Download tracks from a channel',
	(yargs) =>
		yargs
			.positional('slug', {describe: 'Channel slug', type: 'string', demandOption: true})
			.option('output', {
				alias: 'o',
				describe: 'Output directory',
				type: 'string',
				default: '.'
			})
			.option('concurrency', {
				describe: 'Number of concurrent downloads',
				type: 'number',
				default: 5
			})
			.option('dry-run', {
				type: 'boolean',
				default: false,
				describe: 'Show what would happen without doing it'
			})
			.option('premium', {
				describe: 'Use premium YouTube Music (requires --po-token)',
				type: 'boolean',
				default: false
			})
			.option('po-token', {
				describe: 'Premium token for YouTube Music',
				type: 'string'
			})
			.option('retry-failed', {
				describe: 'Retry recently failed downloads (within 24 hours)',
				type: 'boolean',
				default: false
			})
			.group(['output', 'concurrency', 'dry-run', 'retry-failed'], 'Download Options:')
			.group(['premium', 'po-token'], 'Premium Options:')
			.check((argv) => {
				if (argv.premium && !argv['po-token']) {
					throw new Error('--premium requires --po-token')
				}
				return true
			}),
	async (argv) => {
		try {
			if (argv.premium) {
				console.log('Premium mode enabled - using YouTube Music with provided token')
			}

			await downloadChannel(argv.slug, argv.output, {
				r5,
				concurrency: argv.concurrency,
				simulate: argv['dry-run'],
				premium: argv.premium,
				poToken: argv['po-token'],
				retryFailed: argv['retry-failed']
			})
		} catch (error) {
			handleError(error)
		}
	}
)

// Wrap in async IIFE to properly handle async commands
;(async () => {
	await cli.parse()
})()
