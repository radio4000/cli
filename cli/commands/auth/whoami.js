import {sdk} from '@radio4000/sdk'
import {loadSession} from '../../lib/auth.js'
import {formatJSON} from '../../lib/formatters.js'

export default {
	description: 'Show current authenticated user',

	handler: async () => {
		const session = await loadSession()

		if (!session) {
			console.error('Not authenticated. Run: r4 auth login')
			return formatJSON({
				authenticated: false,
				message: 'Not authenticated'
			})
		}

		if (Date.now() / 1000 > session.expires_at) {
			console.error('Session expired. Run: r4 auth login')
			return formatJSON({
				authenticated: false,
				message: 'Session expired'
			})
		}

		const {data, error} = await sdk.supabase.auth.getUser(session.access_token)

		if (error || !data.user) {
			console.error('Failed to fetch user')
			return formatJSON({
				authenticated: false,
				message: 'Failed to fetch user'
			})
		}

		console.error(`Logged in as ${data.user.email} (${data.user.id})`)

		return formatJSON({
			authenticated: true,
			user: {
				id: data.user.id,
				email: data.user.email,
				created_at: data.user.created_at
			},
			session: {
				expires_at: session.expires_at,
				created_at: session.created_at
			}
		})
	},

	examples: ['r4 auth whoami']
}
