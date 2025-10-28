import {signOut} from '../../lib/data.js'

export default {
	description: 'Sign out from Radio4000',

	handler: async () => {
		await signOut()

		console.error('\n✓ Signed out successfully!\n')
		console.error('Remember to unset your R4_AUTH_TOKEN environment variable:')
		console.error('  unset R4_AUTH_TOKEN\n')

		return {
			data: {message: 'Signed out successfully'},
			format: 'json'
		}
	},

	examples: ['r4 auth logout']
}
