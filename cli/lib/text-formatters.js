/**
 * Text formatters for channels and tracks
 * Used by commands and download utilities
 */

/**
 * Format a single channel as human-readable text
 * Used by: r4 channel view --format text and <slug>.txt in downloads
 */
export function formatChannelText(channel) {
	const title = channel.name || 'Untitled Channel'

	// Build optional sections directly
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
 * Format a single track as text (title + URL)
 * Used by track list and download commands
 */
export function formatTrackText(track) {
	return `${track.title}\n${track.description}\n  ${track.url}`
}
