/**
 * Output formatters for CLI commands
 * Commands return raw data, framework handles formatting
 */

/**
 * Format as JSON
 * @param {any} data - Data to format
 * @param {Object} options - Format options
 * @param {boolean} options.pretty - Pretty print JSON (default: true)
 * @returns {string} Formatted JSON string
 */
export function formatJSON(data, {pretty = true} = {}) {
	if (pretty) {
		return JSON.stringify(data, null, 2)
	}
	return JSON.stringify(data)
}

/**
 * Escape string value for SQL
 * @param {any} value - Value to escape
 * @returns {string} Escaped SQL value
 */
function escapeSQLValue(value) {
	if (value === null || value === undefined) {
		return 'NULL'
	}

	if (typeof value === 'number') {
		return String(value)
	}

	if (typeof value === 'boolean') {
		return value ? 'TRUE' : 'FALSE'
	}

	// String escaping - escape single quotes
	const str = String(value)
	return `'${str.replace(/'/g, "''")}'`
}

/**
 * Format as SQL INSERT statements
 * @param {Array|Object} data - Data to format
 * @param {Object} options - Format options
 * @param {string} options.table - Table name for INSERT statements
 * @returns {string} SQL INSERT statements
 */
export function formatSQL(data, {table = 'data'} = {}) {
	// Handle single object
	if (!Array.isArray(data)) {
		data = [data]
	}

	if (data.length === 0) {
		return '-- No data to insert'
	}

	// Get all unique columns from all objects
	const columns = new Set()
	for (const row of data) {
		if (typeof row === 'object' && row !== null) {
			Object.keys(row).forEach((key) => columns.add(key))
		}
	}

	const columnList = Array.from(columns)

	if (columnList.length === 0) {
		return '-- No columns found in data'
	}

	// Generate INSERT statements
	const statements = []

	for (const row of data) {
		if (typeof row !== 'object' || row === null) {
			continue
		}

		const values = columnList.map((col) => escapeSQLValue(row[col]))
		const statement = `INSERT INTO ${table} (${columnList.join(', ')}) VALUES (${values.join(', ')});`
		statements.push(statement)
	}

	return statements.join('\n')
}

/**
 * Format as plain text (simple key-value pairs)
 * @param {any} data - Data to format
 * @returns {string} Plain text representation
 */
export function formatPlainText(data) {
	if (typeof data === 'string') {
		return data
	}

	if (typeof data === 'number' || typeof data === 'boolean') {
		return String(data)
	}

	if (data === null || data === undefined) {
		return ''
	}

	if (Array.isArray(data)) {
		return data.map((item) => formatPlainText(item)).join('\n')
	}

	if (typeof data === 'object') {
		const lines = []
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'object' && value !== null) {
				lines.push(`${key}:`)
				const nested = formatPlainText(value)
				lines.push(
					nested
						.split('\n')
						.map((line) => `  ${line}`)
						.join('\n')
				)
			} else {
				lines.push(`${key}: ${value}`)
			}
		}
		return lines.join('\n')
	}

	return String(data)
}

/**
 * Format data according to specified format
 * @param {any} data - Data to format
 * @param {string} format - Format type ('json', 'sql', 'text')
 * @param {Object} options - Format-specific options
 * @returns {string} Formatted output
 */
export function formatOutput(data, format = 'json', options = {}) {
	switch (format) {
		case 'json':
			return formatJSON(data, options)
		case 'sql':
			return formatSQL(data, options)
		case 'text':
			return formatPlainText(data)
		default:
			throw new Error(`Unknown output format: ${format}`)
	}
}
