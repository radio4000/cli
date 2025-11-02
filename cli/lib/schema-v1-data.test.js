import {expect, test} from 'bun:test'
import {readFile} from 'node:fs/promises'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import {trackSchema} from './schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const V1_TRACKS_PATH = resolve(__dirname, '../../data/tracks_v1.json')

// Validate schema against real v1 data - ensures backward compatibility
test('trackSchema validates v1 data with acceptable error rate', async () => {
	const content = await readFile(V1_TRACKS_PATH, 'utf-8')
	const tracks = JSON.parse(content)

	let invalidCount = 0
	const errorTypes = {}

	tracks.forEach((track) => {
		try {
			trackSchema.parse(track)
		} catch (error) {
			invalidCount++
			const errorType = error.errors?.[0]?.path?.[0] || 'unknown'
			errorTypes[errorType] = (errorTypes[errorType] || 0) + 1
		}
	})

	const errorRate = invalidCount / tracks.length

	// Log only if we exceed thresholds
	if (invalidCount >= 100 || errorRate >= 0.001) {
		console.log(
			`\nSchema validation: ${tracks.length} tracks, ${invalidCount} invalid (${(errorRate * 100).toFixed(3)}%)`
		)
		console.log('Errors by field:', errorTypes)
	}

	// Allow some bad legacy data (filtered in loadV1Tracks)
	expect(invalidCount).toBeLessThan(100)
	expect(errorRate).toBeLessThan(0.001) // Less than 0.1% invalid
})
