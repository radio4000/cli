import {expect, test} from 'bun:test'
import {sdk} from '@radio4000/sdk'
import {z} from 'zod'
import {channelSchema, channelSQL, trackSchema, trackSQL} from './schema.js'

// Columns that exist in the database but we deliberately don't mirror.
// fts is a generated tsvector, coordinates is always null, favorites and
// followers are legacy firebase arrays superseded by the followers table.
const ignored = {
	channel_tracks: ['fts'],
	channels_with_tracks: ['fts', 'coordinates', 'favorites', 'followers']
}

const liveColumns = async (view) => {
	const {data, error} = await sdk.supabase.from(view).select().limit(1).single()
	if (error) throw error
	return Object.keys(data)
		.filter((c) => !ignored[view].includes(c))
		.sort()
}

const zodFields = (schema) =>
	Object.keys(
		z.toJSONSchema(schema, {io: 'output', unrepresentable: 'any'}).properties
	).sort()

const sqlColumns = (sql) =>
	sql
		.split('\n')
		.slice(1, -1)
		.map((line) => line.trim().split(/\s+/)[0])
		.sort()

// Guards against schema drift. When a migration adds or removes a column these
// fail with the exact field to add or delete in schema.js (or to ignore above).
test.each([
	['channel_tracks', trackSchema, trackSQL],
	['channels_with_tracks', channelSchema, channelSQL]
])('%s matches our schemas', async (view, schema, sql) => {
	const columns = await liveColumns(view)
	expect(zodFields(schema)).toEqual(columns)
	expect(sqlColumns(sql)).toEqual(columns)
})
