import {describe, expect, test} from 'bun:test'
import {
	formatJSON,
	formatOutput,
	formatPlainText,
	formatSQL
} from './formatters.js'

describe('formatJSON', () => {
	test('formats objects with pretty and compact modes', () => {
		const data = {name: 'test', value: 42}
		expect(formatJSON(data)).toBe('{\n  "name": "test",\n  "value": 42\n}')
		expect(formatJSON(data, {pretty: false})).toBe('{"name":"test","value":42}')
		expect(formatJSON(null)).toBe('null')
	})
})

describe('formatSQL', () => {
	test('formats single and multiple objects as INSERT statements', () => {
		const single = {id: 1, name: 'test', active: true}
		const result = formatSQL(single, {table: 'users'})
		expect(result).toContain('INSERT INTO users')
		expect(result).toContain("1, 'test', TRUE")

		const multiple = [{id: 1, name: 'Alice'}, {id: 2, name: 'Bob'}]
		const result2 = formatSQL(multiple, {table: 'users'})
		expect(result2.split('\n')).toHaveLength(2)
	})

	test('handles various SQL value types', () => {
		const data = {str: "O'Brien", num: 42, bool: true, nil: null}
		const result = formatSQL(data)
		expect(result).toContain("'O''Brien'") // escaped quotes
		expect(result).toContain('42')
		expect(result).toContain('TRUE')
		expect(result).toContain('NULL')
	})

	test('handles edge cases', () => {
		expect(formatSQL([])).toBe('-- No data to insert')
		expect(formatSQL({id: 1})).toContain('INSERT INTO data') // default table
	})
})

describe('formatPlainText', () => {
	test('formats primitives', () => {
		expect(formatPlainText('hello')).toBe('hello')
		expect(formatPlainText(42)).toBe('42')
		expect(formatPlainText(true)).toBe('true')
		expect(formatPlainText(null)).toBe('')
	})

	test('formats objects and arrays', () => {
		const obj = {name: 'test', value: 42}
		expect(formatPlainText(obj)).toContain('name: test')
		expect(formatPlainText(obj)).toContain('value: 42')

		expect(formatPlainText(['a', 'b', 'c'])).toBe('a\nb\nc')
	})

	test('formats nested structures with indentation', () => {
		const data = {user: {name: 'Alice', age: 30}}
		const result = formatPlainText(data)
		expect(result).toContain('user:')
		expect(result).toContain('  name: Alice')
	})
})

describe('formatOutput', () => {
	const testData = {name: 'test', value: 42}

	test('routes to correct formatter with options', () => {
		expect(formatOutput(testData)).toContain('"name": "test"') // defaults to json
		expect(formatOutput(testData, 'json', {pretty: false})).toBe('{"name":"test","value":42}')
		expect(formatOutput(testData, 'sql', {table: 'test'})).toContain('INSERT INTO test')
		expect(formatOutput(testData, 'text')).toContain('name: test')
	})

	test('throws for unknown format', () => {
		expect(() => formatOutput(testData, 'xml')).toThrow('Unknown output format')
	})
})
