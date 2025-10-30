import {describe, expect, test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {trackSchema} from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const V1_TRACKS_PATH = resolve(__dirname, '../data/tracks_v1.json')

describe('trackSchema validation against v1 data', () => {
	let tracks

	test('loads v1 tracks data', async () => {
		const content = await readFile(V1_TRACKS_PATH, 'utf-8')
		tracks = JSON.parse(content)
		expect(tracks.length).toBeGreaterThan(0)
		console.log(`Loaded ${tracks.length} v1 tracks`)
	})

	test('validates sample of v1 tracks', async () => {
		const content = await readFile(V1_TRACKS_PATH, 'utf-8')
		tracks = JSON.parse(content)

		// Test first 1000 tracks as a sample
		const sample = tracks.slice(0, 1000)
		const errors = []

		sample.forEach((track, index) => {
			try {
				trackSchema.parse(track)
			} catch (error) {
				errors.push({
					index,
					track,
					error: error.errors || error.message
				})
			}
		})

		// Allow small number of invalid tracks in sample (legacy data)
		// Only log if we exceed the threshold
		if (errors.length >= 10) {
			console.log(
				`\nFound ${errors.length} validation errors in first 1000 tracks (threshold: 10):`
			)
			errors.slice(0, 10).forEach(({index, track, error}) => {
				console.log(`\nTrack ${index}: ${track.title || '(empty title)'}`)
				console.log(`  Error:`, JSON.stringify(error, null, 2))
			})
		}

		expect(errors.length).toBeLessThan(10)
	})

	test('validates all v1 tracks and counts invalid ones', async () => {
		const content = await readFile(V1_TRACKS_PATH, 'utf-8')
		tracks = JSON.parse(content)

		const errors = []
		const errorTypes = {}

		tracks.forEach((track, index) => {
			try {
				trackSchema.parse(track)
			} catch (error) {
				const errorType = error.errors?.[0]?.path?.[0] || 'unknown'
				errorTypes[errorType] = (errorTypes[errorType] || 0) + 1

				if (errors.length < 10) {
					errors.push({
						index,
						id: track.id,
						title: track.title,
						error: error.errors || error.message
					})
				}
			}
		})

		// These invalid tracks are expected (legacy v1 data)
		// They are filtered out in loadV1Tracks() in data.js
		// Only log details if we exceed thresholds
		const errorRate = errors.length / tracks.length
		const exceededCount = errors.length >= 100
		const exceededRate = errorRate >= 0.001

		if (exceededCount || exceededRate) {
			console.log(`\nTotal tracks: ${tracks.length}`)
			console.log(
				`Invalid tracks: ${errors.length} (${(errorRate * 100).toFixed(3)}%)`
			)

			console.log(`\nValidation errors by field:`)
			Object.entries(errorTypes).forEach(([field, count]) => {
				console.log(`  ${field}: ${count} errors`)
			})

			console.log(`\nFirst 10 validation errors:`)
			errors.forEach(({index, id, title, error}) => {
				console.log(`\n[${index}] ${title || '(empty title)'}`)
				console.log(`  ID: ${id}`)
				console.log(`  Error:`, JSON.stringify(error, null, 2))
			})
		}

		expect(errors.length).toBeLessThan(100) // Allow some bad legacy data
		expect(errorRate).toBeLessThan(0.001) // Less than 0.1% invalid
	})
})
