/**
 * Formatters for R4 channels and tracks
 * Schema-aware serialization to JSON, SQL, and human-readable text
 */

/**
 * Format any data as JSON
 */
export function toJSON(data) {
	return JSON.stringify(data, null, 2)
}

/**
 * Escape value for SQL
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

	if (Array.isArray(value)) {
		// Handle arrays (like tags) as JSON strings
		return `'${JSON.stringify(value).replace(/'/g, "''")}'`
	}

	// String escaping - escape single quotes
	const str = String(value)
	return `'${str.replace(/'/g, "''")}'`
}

/**
 * Generate SQL INSERT statements from data
 */
function generateSQL(data, table) {
	const items = Array.isArray(data) ? data : [data]

	if (items.length === 0) {
		return '-- No data to insert'
	}

	// Get all unique columns from all objects
	const columns = new Set()
	for (const row of items) {
		if (typeof row === 'object' && row !== null) {
			for (const key of Object.keys(row)) {
				columns.add(key)
			}
		}
	}

	const columnList = Array.from(columns)

	if (columnList.length === 0) {
		return '-- No columns found in data'
	}

	// Generate INSERT statements
	const statements = []
	for (const row of items) {
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
 * Format channel(s) as SQL INSERT statements
 * Handles single channel or array of channels
 */
export function channelToSQL(data) {
	return generateSQL(data, 'channels')
}

/**
 * Format track(s) as SQL INSERT statements
 * Handles single track or array of tracks
 */
export function trackToSQL(data) {
	return generateSQL(data, 'tracks')
}

/**
 * Format a single channel as human-readable text
 */
function formatChannelText(channel) {
	const title = channel.name || 'Untitled Channel'

	const optional = [
		channel.url && `Website: ${channel.url}`,
		channel.image && `Image: ${channel.image}`,
		channel.latitude !== undefined && `Latitude: ${channel.latitude}`,
		channel.longitude !== undefined && `Longitude: ${channel.longitude}`,
		channel.track_count !== undefined && `Tracks: ${channel.track_count}`,
		channel.firebase_id && `Firebase ID: ${channel.firebase_id}`
	]
		.filter(Boolean)
		.join('\n  ')

	return `${title}
${'='.repeat(title.length)}

${channel.description}

Info:
  ID: ${channel.id || 'N/A'}
  Slug: ${channel.slug}
  Source: ${channel.source || 'N/A'}
  Created: ${channel.created_at ? new Date(channel.created_at).toLocaleDateString() : 'Unknown'}
  Updated: ${channel.updated_at ? new Date(channel.updated_at).toLocaleDateString() : 'Unknown'}
${optional ? `  ${optional}\n` : ''}`
}

/**
 * Format channel(s) as human-readable text
 * Handles single channel or array of channels
 */
export function channelToText(data) {
	const channels = Array.isArray(data) ? data : [data]
	return channels.map(formatChannelText).join('\n\n---\n\n')
}

/**
 * Format a single track as human-readable text
 */
function formatTrackText(track) {
	return `${track.title}\n${track.description}\n  ${track.url}`
}

/**
 * Format track(s) as human-readable text
 * Handles single track or array of tracks
 */
export function trackToText(data) {
	const tracks = Array.isArray(data) ? data : [data]
	return tracks.map(formatTrackText).join('\n')
}
