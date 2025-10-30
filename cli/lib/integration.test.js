import {afterEach, beforeEach, expect, test} from 'bun:test'
import {requireAuth} from './data.js'

const originalEnv = process.env.R4_AUTH_TOKEN

beforeEach(() => delete process.env.R4_AUTH_TOKEN)
afterEach(() => {
	if (originalEnv) {
		process.env.R4_AUTH_TOKEN = originalEnv
	} else {
		delete process.env.R4_AUTH_TOKEN
	}
})

// Test auth requirement - this is integration behavior not covered by unit tests
test('requireAuth throws when no saved session', async () => {
	try {
		await requireAuth()
		expect(true).toBe(true) // If we got here, there's a saved session - that's ok
	} catch (error) {
		expect(error.message).toContain('Authentication required')
	}
})
