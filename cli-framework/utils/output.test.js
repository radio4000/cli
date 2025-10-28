import {describe, expect, test} from 'bun:test'
import {formatJSON, formatOutput, formatPlainText, formatSQL} from './output.js'

describe('formatJSON', () => {
	test('formats object as pretty JSON', () => {
		const data = {name: 'test', value: 42}
		const result = formatJSON(data)
		expect(result).toBe('{\n  "name": "test",\n  "value": 42\n}')
	})

	test('formats array as pretty JSON', () => {
		const data = [{id: 1}, {id: 2}]
		const result = formatJSON(data)
		expect(result).toContain('"id": 1')
		expect(result).toContain('"id": 2')
	})

	test('formats as compact JSON when pretty=false', () => {
		const data = {name: 'test', value: 42}
		const result = formatJSON(data, {pretty: false})
		expect(result).toBe('{"name":"test","value":42}')
	})

	test('handles null and undefined', () => {
		expect(formatJSON(null)).toBe('null')
		expect(formatJSON(undefined)).toBe(undefined)
	})
})

describe('formatSQL', () => {
	test('formats single object as INSERT statement', () => {
		const data = {id: 1, name: 'test', active: true}
		const result = formatSQL(data, {table: 'users'})

		expect(result).toContain('INSERT INTO users')
		expect(result).toContain('id, name, active')
		expect(result).toContain("1, 'test', TRUE")
	})

	test('formats array of objects as multiple INSERT statements', () => {
		const data = [
			{id: 1, name: 'Alice'},
			{id: 2, name: 'Bob'}
		]
		const result = formatSQL(data, {table: 'users'})

		expect(result).toContain('INSERT INTO users')
		expect(result).toContain("1, 'Alice'")
		expect(result).toContain("2, 'Bob'")
		const statements = result.split('\n')
		expect(statements).toHaveLength(2)
	})

	test('escapes single quotes in strings', () => {
		const data = {name: "O'Brien"}
		const result = formatSQL(data)

		expect(result).toContain("'O''Brien'")
	})

	test('handles null values', () => {
		const data = {id: 1, description: null}
		const result = formatSQL(data)

		expect(result).toContain('NULL')
	})

	test('handles boolean values', () => {
		const data = {active: true, deleted: false}
		const result = formatSQL(data)

		expect(result).toContain('TRUE')
		expect(result).toContain('FALSE')
	})

	test('handles number values', () => {
		const data = {count: 42, price: 19.99}
		const result = formatSQL(data)

		expect(result).toContain('42')
		expect(result).toContain('19.99')
	})

	test('uses default table name', () => {
		const data = {id: 1}
		const result = formatSQL(data)

		expect(result).toContain('INSERT INTO data')
	})

	test('handles empty array', () => {
		const result = formatSQL([])
		expect(result).toBe('-- No data to insert')
	})

	test('handles objects with different keys', () => {
		const data = [
			{id: 1, name: 'Alice'},
			{id: 2, email: 'bob@test.com'}
		]
		const result = formatSQL(data, {table: 'users'})

		// Should include all columns from all objects
		expect(result).toContain('id, name, email')
		expect(result).toContain('NULL') // for missing values
	})
})

describe('formatPlainText', () => {
	test('formats string as-is', () => {
		expect(formatPlainText('hello')).toBe('hello')
	})

	test('formats number as string', () => {
		expect(formatPlainText(42)).toBe('42')
	})

	test('formats boolean as string', () => {
		expect(formatPlainText(true)).toBe('true')
		expect(formatPlainText(false)).toBe('false')
	})

	test('formats null as empty string', () => {
		expect(formatPlainText(null)).toBe('')
	})

	test('formats simple object as key-value pairs', () => {
		const data = {name: 'test', value: 42}
		const result = formatPlainText(data)

		expect(result).toContain('name: test')
		expect(result).toContain('value: 42')
	})

	test('formats array as line-separated items', () => {
		const data = ['apple', 'banana', 'cherry']
		const result = formatPlainText(data)

		expect(result).toBe('apple\nbanana\ncherry')
	})

	test('formats nested object with indentation', () => {
		const data = {
			user: {
				name: 'Alice',
				age: 30
			}
		}
		const result = formatPlainText(data)

		expect(result).toContain('user:')
		expect(result).toContain('  name: Alice')
		expect(result).toContain('  age: 30')
	})

	test('formats array of objects', () => {
		const data = [
			{id: 1, name: 'Alice'},
			{id: 2, name: 'Bob'}
		]
		const result = formatPlainText(data)

		expect(result).toContain('id: 1')
		expect(result).toContain('name: Alice')
		expect(result).toContain('id: 2')
		expect(result).toContain('name: Bob')
	})
})

describe('formatOutput', () => {
	const testData = {name: 'test', value: 42}

	test('formats as JSON by default', () => {
		const result = formatOutput(testData)
		expect(result).toContain('"name": "test"')
	})

	test('formats as JSON when explicitly specified', () => {
		const result = formatOutput(testData, 'json')
		expect(result).toContain('"name": "test"')
	})

	test('formats as SQL when specified', () => {
		const result = formatOutput(testData, 'sql', {table: 'test'})
		expect(result).toContain('INSERT INTO test')
	})

	test('formats as plain text when specified', () => {
		const result = formatOutput(testData, 'text')
		expect(result).toContain('name: test')
		expect(result).toContain('value: 42')
	})

	test('throws error for unknown format', () => {
		expect(() => formatOutput(testData, 'xml')).toThrow('Unknown output format')
	})

	test('passes options to formatters', () => {
		const result = formatOutput(testData, 'json', {pretty: false})
		expect(result).toBe('{"name":"test","value":42}')
	})
})
