import {z} from 'zod'

/**
 * One list per table. Each field declares its SQLite column type and its
 * runtime validation; the zod schema and the CREATE TABLE both derive from it,
 * so they cannot drift apart. schema.test.js checks them against the live
 * database views, so they cannot drift from Supabase either.
 */

const channelFields = {
	id: {sql: 'TEXT PRIMARY KEY', zod: z.string().optional()},
	slug: {sql: 'TEXT UNIQUE NOT NULL', zod: z.string().min(1).max(100)},
	name: {sql: 'TEXT NOT NULL', zod: z.string().min(1).max(200)},
	description: {sql: 'TEXT', zod: z.string().nullish()},
	url: {sql: 'TEXT', zod: z.string().nullish()},
	image: {sql: 'TEXT', zod: z.string().nullish()},
	latitude: {sql: 'REAL', zod: z.number().nullish()},
	longitude: {sql: 'REAL', zod: z.number().nullish()},
	track_count: {sql: 'INTEGER', zod: z.number().int().nonnegative().nullish()},
	firebase_id: {sql: 'TEXT', zod: z.string().nullish()},
	created_at: {sql: 'TEXT', zod: z.iso.datetime({offset: true}).optional()},
	updated_at: {sql: 'TEXT', zod: z.iso.datetime({offset: true}).optional()},
	latest_track_at: {sql: 'TEXT', zod: z.iso.datetime({offset: true}).nullish()}
}

const trackFields = {
	id: {sql: 'TEXT PRIMARY KEY', zod: z.string().optional()},
	slug: {sql: 'TEXT NOT NULL', zod: z.string()}, // channel slug, via the view
	title: {sql: 'TEXT NOT NULL', zod: z.string().min(1).max(500)},
	url: {sql: 'TEXT NOT NULL', zod: z.string().url()},
	description: {sql: 'TEXT', zod: z.string().nullish().default('')},
	discogs_url: {sql: 'TEXT', zod: z.string().url().nullish()},
	tags: {sql: 'TEXT', zod: z.array(z.string()).default([])},
	mentions: {sql: 'TEXT', zod: z.array(z.string()).default([])},
	duration: {sql: 'INTEGER', zod: z.number().int().nonnegative().nullish()},
	playback_error: {sql: 'TEXT', zod: z.string().nullish()},
	provider: {sql: 'TEXT', zod: z.string().nullish()},
	media_id: {sql: 'TEXT', zod: z.string().nullish()},
	created_at: {sql: 'TEXT', zod: z.iso.datetime({offset: true}).optional()},
	updated_at: {sql: 'TEXT', zod: z.iso.datetime({offset: true}).optional()}
}

const shape = (fields) =>
	Object.fromEntries(Object.entries(fields).map(([name, f]) => [name, f.zod]))

const createTable = (table, fields) =>
	`CREATE TABLE IF NOT EXISTS ${table} (\n${Object.entries(fields)
		.map(([name, f]) => `  ${name} ${f.sql}`)
		.join(',\n')}\n);`

// Zod validation schemas
export const channelSchema = z.object(shape(channelFields))

export const trackSchema = z.preprocess(
	(data) => ({
		...data,
		discogs_url: data.discogs_url === '' ? null : data.discogs_url
	}),
	z.object(shape(trackFields))
)

// SQL CREATE TABLE schemas
export const channelSQL = createTable('channels', channelFields)
export const trackSQL = createTable('tracks', trackFields)
