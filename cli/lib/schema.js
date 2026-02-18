import {z} from 'zod'

// Zod validation schemas
export const channelSchema = z.object({
	id: z.string().optional(),
	slug: z.string().min(1).max(100),
	name: z.string().min(1).max(200),
	description: z.string().nullish(),
	url: z.string().nullish(),
	image: z.string().nullish(),
	latitude: z.number().nullish(),
	longitude: z.number().nullish(),
	track_count: z.number().int().nonnegative().nullish(),
	firebase_id: z.string().nullish(),
	created_at: z.iso.datetime({offset: true}).optional(),
	updated_at: z.iso.datetime({offset: true}).optional(),
	latest_track_at: z.iso.datetime({offset: true}).nullish()
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
		duration: z.number().int().nonnegative().nullish(),
		playback_error: z.string().nullish(),
		provider: z.string().nullish(),
		media_id: z.string().nullish(),
		created_at: z.iso.datetime({offset: true}).optional(),
		updated_at: z.iso.datetime({offset: true}).optional()
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
  latest_track_at TEXT
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
  updated_at TEXT
);`
