import {signIn} from '../../lib/data.js'

export default {
	description: 'Authenticate with Radio4000',

	options: {
		email: {
			type: 'string',
			description: 'Email address',
			required: true
		},
		password: {
			type: 'string',
			description: 'Password',
			required: true
		}
	},

	handler: async ({flags}) => {
		const authData = await signIn(flags.email, flags.password)

		// Output instructions for setting token
		const token = authData.session?.access_token
		if (token) {
			console.error('\n✓ Authentication successful!\n')
			console.error('To use this session, set the environment variable:')
			console.error(`  export R4_AUTH_TOKEN="${token}"\n`)
			console.error(
				'Or add it to your shell profile (~/.bashrc, ~/.zshrc, etc.)\n'
			)
		}

		return {
			data: {
				user: authData.user,
				message: 'Authenticated successfully'
			},
			format: 'json'
		}
	},

	examples: [
		'r4 auth login --email "you@example.com" --password "yourpassword"'
	]
}
