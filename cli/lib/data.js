import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sdk } from '@radio4000/sdk';
import { channelSchema, trackSchema } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// V1 data paths
const V1_CHANNELS_PATH = resolve(__dirname, '../data/channels_v1.json');
const V1_TRACKS_PATH = resolve(__dirname, '../data/tracks_v1.json');

// Cache for v1 data
let v1ChannelsCache = null;
let v1TracksCache = null;

// ===== V1 DATA LOADERS =====

export async function loadV1Channels() {
	if (v1ChannelsCache) return v1ChannelsCache;

	const content = await readFile(V1_CHANNELS_PATH, 'utf-8');
	const channels = JSON.parse(content);
	v1ChannelsCache = channels.map(ch => channelSchema.parse({ ...ch, source: 'v1' }));
	return v1ChannelsCache;
}

export async function loadV1Tracks() {
	if (v1TracksCache) return v1TracksCache;

	const content = await readFile(V1_TRACKS_PATH, 'utf-8');
	const tracks = JSON.parse(content);
	// Filter out invalid tracks (v1 data may have empty/invalid URLs)
	v1TracksCache = tracks
		.map(tr => {
			try {
				return trackSchema.parse({ ...tr, source: 'v1' })
			} catch {
				return null // Skip invalid tracks
			}
		})
		.filter(Boolean);
	return v1TracksCache;
}

// ===== AUTH HELPERS =====

export function getAuthToken() {
	return process.env.R4_AUTH_TOKEN || null;
}

export function requireAuth() {
	const token = getAuthToken();
	if (!token) {
		throw new Error('Authentication required. Run: r4 auth login\nOr set R4_AUTH_TOKEN environment variable.');
	}
	return token;
}

// ===== CHANNEL OPERATIONS =====

export async function listChannels() {
	try {
		const { data: channels, error } = await sdk.channels.readChannels();
		if (error) throw new Error(error);
		return channels.map(ch => channelSchema.parse({ ...ch, source: 'v2' }));
	} catch (error) {
		console.warn('API unavailable, using bundled v1 data');
		return await loadV1Channels();
	}
}

export async function getChannel(slug) {
	try {
		const { data: channel, error } = await sdk.channels.readChannel(slug);
		if (error) throw new Error(error);
		return channelSchema.parse({ ...channel, source: 'v2' });
	} catch (error) {
		// Fall back to v1
		const v1Channels = await loadV1Channels();
		const channel = v1Channels.find(ch => ch.slug === slug);
		if (!channel) {
			throw new Error(`Channel not found: ${slug}`);
		}
		return channel;
	}
}

export async function createChannel(data) {
	requireAuth();
	const { data: channel, error } = await sdk.channels.createChannel(data);
	if (error) throw new Error(error);
	return channelSchema.parse({ ...channel, source: 'v2' });
}

export async function updateChannel(slug, updates) {
	requireAuth();

	// Check if it's a v1 channel (read-only)
	const channel = await getChannel(slug);
	if (channel.source === 'v1') {
		throw new Error(`Cannot modify v1 channel: ${slug}. This is a read-only archived channel.`);
	}

	const { data: updated, error } = await sdk.channels.updateChannel(channel.id, updates);
	if (error) throw new Error(error);
	return channelSchema.parse({ ...updated, source: 'v2' });
}

export async function deleteChannel(slug) {
	requireAuth();

	// Check if it's a v1 channel (read-only)
	const channel = await getChannel(slug);
	if (channel.source === 'v1') {
		throw new Error(`Cannot delete v1 channel: ${slug}. This is a read-only archived channel.`);
	}

	const { error } = await sdk.channels.deleteChannel(channel.id);
	if (error) throw new Error(error);
	return { success: true, slug };
}

// ===== TRACK OPERATIONS =====

export async function listTracks(options = {}) {
	const { channelSlugs } = options;

	try {
		// If filtering by channels, we need to get each channel's tracks
		if (channelSlugs && channelSlugs.length > 0) {
			const allTracks = [];
			for (const slug of channelSlugs) {
				const { data: tracks, error } = await sdk.channels.readChannelTracks(slug);
				if (error) throw new Error(error);
				allTracks.push(...tracks);
			}
			return allTracks.map(tr => trackSchema.parse({ ...tr, source: 'v2' }));
		}

		// Otherwise, we'd need a "read all tracks" endpoint
		// For now, fall back to v1 or return empty
		console.warn('Listing all tracks requires channel filter or v1 fallback');
		return await loadV1Tracks();
	} catch (error) {
		console.warn('API unavailable, using bundled v1 data');
		let tracks = await loadV1Tracks();

		// Filter by channel slugs if requested
		if (channelSlugs && channelSlugs.length > 0) {
			tracks = tracks.filter(tr => channelSlugs.includes(tr.slug));
		}

		return tracks;
	}
}

export async function getTrack(id) {
	try {
		const { data: track, error } = await sdk.tracks.readTrack(id);
		if (error) throw new Error(error);
		return trackSchema.parse({ ...track, source: 'v2' });
	} catch (error) {
		// Fall back to v1
		const v1Tracks = await loadV1Tracks();
		const track = v1Tracks.find(tr => tr.id === id);
		if (!track) {
			throw new Error(`Track not found: ${id}`);
		}
		return track;
	}
}

export async function createTrack(data) {
	requireAuth();

	// We need the channel_id for the SDK
	// If data has channel slug, we need to look it up
	let channelId = data.channel_id;
	if (!channelId && data.slug) {
		const channel = await getChannel(data.slug);
		channelId = channel.id;
	}

	if (!channelId) {
		throw new Error('channel_id or channel slug required');
	}

	const { data: track, error } = await sdk.tracks.createTrack(channelId, data);
	if (error) throw new Error(error);
	return trackSchema.parse({ ...track, source: 'v2' });
}

export async function updateTrack(id, updates) {
	requireAuth();

	// Check if it's a v1 track (read-only)
	const track = await getTrack(id);
	if (track.source === 'v1') {
		throw new Error(`Cannot modify v1 track: ${id}. This is a read-only archived track.`);
	}

	const { data: updated, error } = await sdk.tracks.updateTrack(id, updates);
	if (error) throw new Error(error);
	return trackSchema.parse({ ...updated, source: 'v2' });
}

export async function deleteTrack(id) {
	requireAuth();

	// Check if it's a v1 track (read-only)
	const track = await getTrack(id);
	if (track.source === 'v1') {
		throw new Error(`Cannot delete v1 track: ${id}. This is a read-only archived track.`);
	}

	const { error } = await sdk.tracks.deleteTrack(id);
	if (error) throw new Error(error);
	return { success: true, id };
}

// ===== AUTH OPERATIONS =====

export async function signIn(email, password) {
	const { data, error } = await sdk.auth.signIn({ email, password });
	if (error) throw new Error(error);
	return data;
}

export async function signOut() {
	const { error } = await sdk.auth.signOut();
	if (error) throw new Error(error);
	return { success: true };
}

export async function readUser() {
	const token = getAuthToken();
	if (!token) return null;

	const { data, error } = await sdk.users.readUser(token);
	if (error) throw new Error(error);
	return data;
}
