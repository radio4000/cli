// Channel view command for testing
export default {
	description: 'View channel details',
	args: [
		{
			name: 'slug',
			description: 'Channel slug',
			required: true,
			multiple: false
		}
	],
	options: {
		json: {
			type: 'boolean',
			description: 'Output as JSON',
			default: true
		}
	},
	handler: async ({args, flags}) => {
		return {
			success: true,
			command: 'channel:view',
			slug: args.slug,
			json: flags.json
		}
	}
}
