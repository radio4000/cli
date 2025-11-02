import * as config from '../../lib/config.js'
import {toJSON} from '../../lib/formatters.js'

export default {
	description: 'Clear local session',

	async run() {
		await config.update({auth: {session: null}})
		return toJSON({cleared: true})
	},

	examples: ['r4 auth logout']
}
