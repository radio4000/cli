// Channel list command for testing
export default {
	description: 'List all channels',
	args: [],
	options: {
		limit: {
			type: 'string',
			description: 'Limit results',
			parse: (val) => parseInt(val, 10)
		}
	},
	handler: async ({flags}) => {
		return {success: true, command: 'channel:list', limit: flags.limit}
	}
}
