import {z} from 'zod'
import {getChannel, listTracks} from '../../lib/data.js'
import {downloadChannel} from '../../lib/download.js'

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
		folder: {
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

	validate: z.object({
		slug: z.string().min(1)
	}),

	handler: async ({args, flags}) => {
		const {slug} = args
		const folderPath = flags.folder || `./downloads/${slug}`

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug], limit: flags.limit})

		console.log(`Channel: ${channel.name} (@${channel.slug})`)
		console.log(`Folder: ${folderPath}`)
		console.log()

		// Download
		const result = await downloadChannel(tracks, folderPath, {
			force: flags.force,
			dryRun: flags.dryRun,
			debug: flags.debug,
			writeMetadata: !flags.noMetadata
		})

		console.log()
		console.log('Summary:')
		console.log(`- Total: ${result.total}`)
		console.log(`- Downloaded: ${result.downloaded}`)
		console.log(`- Already exists: ${result.existing}`)
		console.log(`- Unavailable: ${result.unavailable}`)
		console.log(`- Failed: ${result.failed}`)

		if (result.failures.length > 0) {
			console.log()
			console.log('Failures:')
			for (const failure of result.failures) {
				console.log(`- ${failure.track.title}`)
				console.log(`  ${failure.error}`)
			}
		}

		return {
			data: result,
			format: 'json'
		}
	},

	examples: [
		'r4 channel download ko002',
		'r4 channel download ko002 --limit 10',
		'r4 channel download ko002 --folder ./my-music',
		'r4 channel download ko002 --dry-run',
		'r4 channel download ko002 --force',
		'r4 channel download ko002 --no-metadata'
	]
}
