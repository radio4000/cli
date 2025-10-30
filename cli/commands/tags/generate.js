import {existsSync} from 'node:fs'
import {mkdir, rm, symlink} from 'node:fs/promises'
import {resolve} from 'node:path'
import {getChannel, listTracks} from '../../lib/data.js'
import {toExtension, toFilename} from '../../lib/download.js'
import {extractTags, getUniqueTags} from '../../lib/tags.js'

export default {
	description:
		'Generate tag-based folder structure with symlinks to downloaded tracks',

	args: [
		{
			name: 'slug',
			description: 'Channel slug to generate tags for',
			required: true
		}
	],

	options: {
		output: {
			type: 'string',
			description: 'Base folder path (defaults to ./<slug>)'
		},
		clean: {
			type: 'boolean',
			description: 'Remove existing tags folder before generating',
			default: true
		},
		'dry-run': {
			type: 'boolean',
			description: 'Show what would be created without creating it',
			default: false
		},
		verbose: {
			type: 'boolean',
			description: 'Show detailed output',
			default: false
		}
	},

	handler: async (input) => {
		const {slug} = input
		const basePath = resolve(input.output || `./${slug}`)
		const tagsPath = `${basePath}/tags`
		const tracksPath = `${basePath}/tracks`
		const dryRun = input['dry-run']
		const clean = input.clean
		const verbose = input.verbose

		// Get channel and tracks
		const channel = await getChannel(slug)
		const tracks = await listTracks({channelSlugs: [slug]})

		console.log(`Generating tags folder for: ${channel.name} (@${slug})`)
		if (dryRun) {
			console.log('(Dry run - no files will be created)')
		}
		console.log()

		// Check if tracks folder exists
		if (!existsSync(tracksPath)) {
			console.log(`Error: Tracks folder not found at: ${tracksPath}`)
			console.log(
				`\nPlease download the channel first with: r4 download ${slug}`
			)
			return ''
		}

		// Clean existing tags folder if requested
		if (clean && existsSync(tagsPath)) {
			if (!dryRun) {
				await rm(tagsPath, {recursive: true, force: true})
				verbose && console.log(`Removed existing tags folder: ${tagsPath}`)
			} else {
				console.log(`Would remove existing tags folder: ${tagsPath}`)
			}
		}

		// Get all tags
		const {tagMap} = getUniqueTags(tracks)

		if (tagMap.size === 0) {
			console.log('No tags found in channel tracks')
			return ''
		}

		// Statistics
		let totalSymlinks = 0
		let tracksWithTags = 0
		let tracksSkipped = 0
		const tagStats = new Map()

		// Process each track
		for (const track of tracks) {
			// Use parsed tags array if available, otherwise extract from text
			let trackTags
			if (track.tags && Array.isArray(track.tags)) {
				trackTags = track.tags.map((t) => t.toLowerCase())
			} else {
				const text = track.description || track.body || ''
				trackTags = extractTags(text)
			}

			if (trackTags.length === 0) {
				continue
			}

			// Build expected track filename and path
			const filename = toFilename(track)
			const extension = toExtension(track)
			const trackFilename = `${filename}.${extension}`
			const trackPath = `${tracksPath}/${trackFilename}`

			// Check if track file exists
			if (!existsSync(trackPath)) {
				verbose && console.log(`Skipping ${trackFilename} (file not found)`)
				tracksSkipped++
				continue
			}

			tracksWithTags++

			// Create symlinks for each tag
			for (const tag of trackTags) {
				const tagFolderPath = `${tagsPath}/${tag}`
				const symlinkPath = `${tagFolderPath}/${trackFilename}`

				if (dryRun) {
					verbose && console.log(`Would create: ${symlinkPath} -> ${trackPath}`)
				} else {
					try {
						// Create tag folder
						await mkdir(tagFolderPath, {recursive: true})

						// Create symlink (relative to make it portable)
						// From: tags/ambient/track.m4a
						// To:   ../../tracks/track.m4a
						const relativeTrackPath = `../../tracks/${trackFilename}`
						await symlink(relativeTrackPath, symlinkPath)

						verbose && console.log(`Created: ${tag}/${trackFilename}`)

						totalSymlinks++
						tagStats.set(tag, (tagStats.get(tag) || 0) + 1)
					} catch (error) {
						if (error.code !== 'EEXIST') {
							console.error(
								`Error creating symlink for ${tag}/${trackFilename}:`,
								error.message
							)
						}
					}
				}
			}
		}

		// Summary
		console.log()
		console.log('Summary:')
		console.log(`  Total tracks: ${tracks.length}`)
		console.log(`  Tracks with tags: ${tracksWithTags}`)
		if (tracksSkipped > 0) {
			console.log(`  Tracks skipped (not downloaded): ${tracksSkipped}`)
		}
		console.log(`  Unique tags: ${tagMap.size}`)
		if (!dryRun) {
			console.log(`  Symlinks created: ${totalSymlinks}`)
			console.log()
			console.log(`Tags folder: ${tagsPath}`)

			// Show top tags
			const sortedTagStats = Array.from(tagStats.entries()).sort(
				(a, b) => b[1] - a[1]
			)
			if (sortedTagStats.length > 0) {
				console.log()
				console.log('Top tags:')
				for (const [tag, count] of sortedTagStats.slice(0, 10)) {
					console.log(`  ${count.toString().padStart(3, ' ')}  ${tag}`)
				}
				if (sortedTagStats.length > 10) {
					console.log(`  ... and ${sortedTagStats.length - 10} more`)
				}
			}
		}

		return ''
	},

	examples: [
		'r4 tags generate ko002',
		'r4 tags generate ko002 --output ./my-music',
		'r4 tags generate ko002 --dry-run',
		'r4 tags generate ko002 --verbose',
		'r4 tags generate ko002 --no-clean'
	]
}
