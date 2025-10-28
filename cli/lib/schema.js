import { z } from 'zod';

// Channel schema - used for both reading and writing
export const channelSchema = z.object({
	id: z.string().optional(),
	slug: z.string().min(1).max(100),
	name: z.string().min(1).max(200),
	description: z.string().default(''),
	image: z.string().default(''),
	track_count: z.number().int().nonnegative().default(0),
	firebase_id: z.string().optional(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	source: z.enum(['v1', 'v2']).default('v2')
});

// Track schema - used for both reading and writing
export const trackSchema = z.object({
	id: z.string().optional(),
	firebase_id: z.string().optional(),
	channel_id: z.string().optional(),
	slug: z.string(), // channel slug
	title: z.string().min(1).max(500),
	url: z.string().url(),
	created_at: z.string().optional(),
	updated_at: z.string().optional(),
	source: z.enum(['v1', 'v2']).default('v2')
});
