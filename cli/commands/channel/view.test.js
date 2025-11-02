import {describe, expect, test} from 'bun:test'

// Test command integration - format options are the key behavior
// (Data fetching is tested in data.test.js, framework routing in cli-framework/)
describe('channel view command', () => {
	test('formats output as JSON (default)', async () => {
		const command = await import('./view.js')
		const result = await command.default.run(['ko002'])

		expect(typeof result).toBe('string')
		const parsed = JSON.parse(result)
		expect(parsed.slug).toBe('ko002')
	})

	test('formats output as SQL', async () => {
		const command = await import('./view.js')
		const result = await command.default.run(['ko002', '--format', 'sql'])

		expect(result).toContain('INSERT INTO channels')
		expect(result).toContain('ko002')
	})

	test('formats output as text', async () => {
		const command = await import('./view.js')
		const result = await command.default.run(['ko002', '--format', 'text'])

		expect(result).toContain('ko002')
		expect(result).toContain('Info:')
	})
})
