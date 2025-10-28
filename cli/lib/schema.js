import {z} from 'zod'

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
