import {z} from 'zod'

// Zod validation schemas
export const channelSchema = z.object({
	id: z.string().optional(),
	slug: z.string().min(1).max(100),
	name: z.string().min(1).max(200),
	description: z.string().default(''),
	url: z.string().default(''),
	image: z.string().default(''),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	track_count: z.number().int().nonnegative().optional(),
	firebase_id: z.string().optional(),
	created_at: z.iso.datetime({offset: true}).optional(),
	updated_at: z.iso.datetime({offset: true}).optional(),
	source: z.enum(['v1', 'v2']).default('v2')
})

export const trackSchema = z.preprocess(
	(data) => ({
		...data,
		discogs_url: data.discogs_url === '' ? null : data.discogs_url
	}),
	z.object({
		id: z.string().optional(),
		firebase_id: z.string().optional(),
		channel_id: z.string().optional(),
		slug: z.string(), // channel slug
		title: z.string().min(1).max(500),
		url: z.string().url(),
		description: z.string().nullish().default(''),
		discogs_url: z.string().url().nullish(),
		tags: z.array(z.string()).default([]),
		created_at: z.iso.datetime({offset: true}).optional(),
		updated_at: z.iso.datetime({offset: true}).optional(),
		source: z.enum(['v1', 'v2']).default('v2')
	})
)

// SQL CREATE TABLE schemas
export const channelSQL = `CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT,
  image TEXT,
  latitude REAL,
  longitude REAL,
  track_count INTEGER,
  firebase_id TEXT,
  created_at TEXT,
  updated_at TEXT,
  source TEXT
);`

export const trackSQL = `CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  firebase_id TEXT,
  channel_id TEXT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  discogs_url TEXT,
  tags TEXT,
  created_at TEXT,
  updated_at TEXT,
  source TEXT
);`
