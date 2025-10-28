import { readUser } from '../../lib/data.js';

export default {
	description: 'Show current authenticated user',

	handler: async () => {
		const user = await readUser();

		if (!user) {
			return {
				data: {
					authenticated: false,
					message: 'Not authenticated. Run: r4 auth login'
				},
				format: 'json'
			};
		}

		return {
			data: {
				authenticated: true,
				user
			},
			format: 'json'
		};
	},

	examples: [
		'r4 auth whoami'
	]
};
