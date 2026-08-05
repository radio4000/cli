import {describe, expect, test} from 'bun:test'
import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

describe('channel backup command', () => {
	test('returns a valid backup JSON', async () => {
		const command = await import('./backup.js')
		const result = await command.default.run(['ko002'])

		expect(typeof result).toBe('string')
		const parsed = JSON.parse(result)
		expect(parsed.version).toBe(2)
		expect(typeof parsed.created_at).toBe('string')
		expect(parsed.channel.slug).toBe('ko002')
		expect(Array.isArray(parsed.tracks)).toBe(true)
	})

	test('saves backup to file with --output', async () => {
		const command = await import('./backup.js')
		const dir = await mkdtemp(join(tmpdir(), 'r4-backup-'))
		const output = join(dir, 'backup.json')

		const result = await command.default.run(['ko002', '--output', output])
		expect(result).toContain(output)

		const contents = JSON.parse(await readFile(output, 'utf8'))
		expect(contents.version).toBe(2)
		expect(contents.channel.slug).toBe('ko002')

		await rm(dir, {recursive: true})
	})

	test('throws when no slug is provided', async () => {
		const command = await import('./backup.js')
		expect(command.default.run([])).rejects.toThrow('Channel slug is required')
	})
})
