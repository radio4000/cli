import {clearSession} from '../../lib/auth.js'
import {formatJSON} from '../../lib/formatters.js'

export default {
	description: 'Clear local session',

	handler: async () => {
		await clearSession()
		return formatJSON({cleared: true})
	},

	examples: ['r4 auth logout']
}
