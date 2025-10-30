/**
 * Shared option definitions for CLI commands
 */

/**
 * SQL output option (for create/update/delete operations)
 */
export const sqlOption = {
	sql: {
		type: 'boolean',
		description: 'Output as SQL statements',
		default: false
	}
}

/**
 * Format option with validation (for view/list operations)
 */
export const formatOption = {
	format: {
		type: 'string',
		description: 'Output format: text, json, or sql',
		default: 'json',
		parse: (val) => {
			if (!['json', 'sql', 'text'].includes(val)) {
				throw new Error('must be json, sql, or text')
			}
			return val
		}
	}
}
