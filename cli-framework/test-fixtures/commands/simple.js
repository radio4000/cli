// Simple command for testing
export default {
	description: 'A simple test command',
	args: [],
	options: {},
	handler: async () => {
		return {success: true, command: 'simple'}
	}
}
