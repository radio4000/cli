#!/usr/bin/env bun
import { expect, test, describe } from 'bun:test';
import { $ } from 'bun';

// Mock CLI for testing the interface design
// This simulates what the real r4 CLI would do
const r4 = {
	channel: {
		list: async (opts = {}) => {
			// Mock: return list of channels
			const channels = [
				{ slug: 'ko002', name: 'Ko002 Radio' },
				{ slug: 'oskar', name: 'Oskar\'s Sounds' }
			];
			return opts.sql ? mockSQL('channels', channels) : channels;
		},
		view: async (slugs, opts = {}) => {
			const channels = slugs.map(slug => ({
				slug,
				name: `${slug} Radio`,
				description: 'A cool radio'
			}));
			return opts.sql ? mockSQL('channels', channels) : channels;
		},
		create: async (slug, opts = {}) => {
			return { slug, ...opts, id: 'ch_' + Math.random() };
		},
		update: async (slugs, opts = {}) => {
			return slugs.map(slug => ({ slug, ...opts }));
		},
		delete: async (slugs) => {
			return { deleted: slugs };
		}
	},
	track: {
		list: async (opts = {}) => {
			const tracks = [
				{ id: 't1', title: 'Song 1', url: 'https://yt/1', channel: 'ko002' },
				{ id: 't2', title: 'Song 2', url: 'https://yt/2', channel: 'ko002' },
				{ id: 't3', title: 'Song 3', url: 'https://yt/3', channel: 'oskar' }
			];
			const filtered = opts.channels
				? tracks.filter(t => opts.channels.includes(t.channel))
				: tracks;
			return opts.sql ? mockSQL('tracks', filtered) : filtered;
		},
		view: async (ids, opts = {}) => {
			const tracks = ids.map(id => ({
				id,
				title: `Song ${id}`,
				url: `https://yt/${id}`
			}));
			return opts.sql ? mockSQL('tracks', tracks) : tracks;
		},
		create: async (data, opts = {}) => {
			// Accept JSON from stdin or options
			const track = { id: 't_' + Math.random(), ...data, ...opts };
			return track;
		},
		update: async (ids, opts = {}) => {
			return ids.map(id => ({ id, ...opts }));
		},
		delete: async (ids) => {
			return { deleted: ids };
		}
	},
	auth: {
		login: async () => ({ success: true, user: 'test@example.com' }),
		logout: async () => ({ success: true }),
		whoami: async () => ({
			user: 'test@example.com',
			defaultChannel: 'ko002'
		})
	},
	add: async (url, opts = {}) => {
		// Porcelain: fetch metadata + create
		const metadata = { title: 'Auto Song', url };
		return r4.track.create(metadata, opts);
	}
};

// Mock SQL generator
function mockSQL(table, data) {
	const lines = [`CREATE TABLE IF NOT EXISTS ${table} (...);`];
	data.forEach(row => {
		lines.push(`INSERT INTO ${table} VALUES (${JSON.stringify(row)});`);
	});
	return lines.join('\n');
}

describe('r4 CLI interface tests', () => {
	describe('channel operations', () => {
		test('r4 channel list', async () => {
			const result = await r4.channel.list();
			expect(result).toBeArray();
			expect(result[0]).toHaveProperty('slug');
		});

		test('r4 channel view ko002 oskar', async () => {
			const result = await r4.channel.view(['ko002', 'oskar']);
			expect(result).toHaveLength(2);
			expect(result[0].slug).toBe('ko002');
		});

		test('r4 channel create mysounds --name "My Sounds"', async () => {
			const result = await r4.channel.create('mysounds', { name: 'My Sounds' });
			expect(result.slug).toBe('mysounds');
			expect(result.name).toBe('My Sounds');
		});

		test('r4 channel update ko002 oskar --name "Updated"', async () => {
			const result = await r4.channel.update(['ko002', 'oskar'], { name: 'Updated' });
			expect(result).toHaveLength(2);
		});

		test('r4 channel delete ko002', async () => {
			const result = await r4.channel.delete(['ko002']);
			expect(result.deleted).toContain('ko002');
		});

		test('r4 channel list --sql', async () => {
			const result = await r4.channel.list({ sql: true });
			expect(result).toBeString();
			expect(result).toContain('CREATE TABLE');
			expect(result).toContain('INSERT INTO');
		});
	});

	describe('track operations', () => {
		test('r4 track list', async () => {
			const result = await r4.track.list();
			expect(result).toBeArray();
			expect(result.length).toBeGreaterThan(0);
		});

		test('r4 track list --channel ko002', async () => {
			const result = await r4.track.list({ channels: ['ko002'] });
			expect(result).toBeArray();
			expect(result.every(t => t.channel === 'ko002')).toBe(true);
		});

		test('r4 track list --channel ko002 --channel oskar', async () => {
			const result = await r4.track.list({ channels: ['ko002', 'oskar'] });
			expect(result).toBeArray();
			expect(result.length).toBe(3); // All tracks from both channels
			expect(result.every(t => ['ko002', 'oskar'].includes(t.channel))).toBe(true);
		});

		test('r4 track view t1 t2', async () => {
			const result = await r4.track.view(['t1', 't2']);
			expect(result).toHaveLength(2);
		});

		test('r4 track create --title "Song" --url "..." --channel mysounds', async () => {
			const result = await r4.track.create({}, {
				title: 'Song',
				url: 'https://yt/123',
				channel: 'mysounds'
			});
			expect(result.title).toBe('Song');
			expect(result.channel).toBe('mysounds');
		});

		test('echo {...} | r4 track create --channel mysounds (stdin)', async () => {
			const stdin = { title: 'Piped Song', url: 'https://yt/pipe' };
			const result = await r4.track.create(stdin, { channel: 'mysounds' });
			expect(result.title).toBe('Piped Song');
		});

		test('r4 track update t1 t2 --title "Updated"', async () => {
			const result = await r4.track.update(['t1', 't2'], { title: 'Updated' });
			expect(result).toHaveLength(2);
		});

		test('r4 track delete t1 t2 t3', async () => {
			const result = await r4.track.delete(['t1', 't2', 't3']);
			expect(result.deleted).toHaveLength(3);
		});

		test('r4 track list --sql', async () => {
			const result = await r4.track.list({ sql: true });
			expect(result).toBeString();
			expect(result).toContain('CREATE TABLE');
		});
	});

	describe('auth operations', () => {
		test('r4 auth login', async () => {
			const result = await r4.auth.login();
			expect(result.success).toBe(true);
		});

		test('r4 auth whoami', async () => {
			const result = await r4.auth.whoami();
			expect(result.user).toBeDefined();
			expect(result.defaultChannel).toBeDefined();
		});

		test('r4 auth logout', async () => {
			const result = await r4.auth.logout();
			expect(result.success).toBe(true);
		});
	});

	describe('porcelain operations', () => {
		test('r4 add "https://youtube.com/..." --channel mysounds', async () => {
			const result = await r4.add('https://youtube.com/watch?v=123', {
				channel: 'mysounds'
			});
			expect(result.url).toContain('youtube');
			expect(result.channel).toBe('mysounds');
		});
	});

	describe('composability - the fun stuff!', () => {
		test('pipe workflow: list -> transform -> create', async () => {
			// Simulate: r4 track list --channel old | jq 'map({title,url})' | r4 track create --channel new
			const oldTracks = await r4.track.list({ channels: ['ko002'] });
			const transformed = oldTracks.map(({ title, url }) => ({ title, url }));
			const results = await Promise.all(
				transformed.map(data => r4.track.create(data, { channel: 'new' }))
			);
			expect(results).toBeArray();
			expect(results[0].channel).toBe('new');
		});

		test('sqlite export: channels + tracks', async () => {
			// Simulate: (r4 channel view ko002 oskar --sql; r4 track list --channel ko002 --channel oskar --sql) | sqlite3 my.db
			const channelSQL = await r4.channel.view(['ko002', 'oskar'], { sql: true });
			const trackSQL = await r4.track.list({ channels: ['ko002', 'oskar'], sql: true });

			expect(channelSQL).toContain('CREATE TABLE');
			expect(trackSQL).toContain('CREATE TABLE');

			// In real usage, this would pipe to sqlite3
			const combined = `${channelSQL}\n${trackSQL}`;
			expect(combined.split('INSERT INTO').length).toBeGreaterThan(2);
		});

		test('jq integration: extract titles', async () => {
			// Simulate: r4 track list --channel foo | jq '.[] | .title'
			const tracks = await r4.track.list({ channels: ['ko002'] });
			const titles = tracks.map(t => t.title);
			expect(titles).toEqual(['Song 1', 'Song 2']);
		});
	});
});
