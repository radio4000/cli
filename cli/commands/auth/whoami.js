import * as config from '../../lib/config.js'
import {toJSON} from '../../lib/formatters.js'

export default {
	description: 'Show current session',

	async run() {
		const data = await config.load()
		const session = data.auth?.session || null
		return toJSON(session)
	},

	examples: ['r4 auth whoami']
}
