import {createChannelBackup} from '../../lib/data.js'
import {parse} from '../../utils.js'

export default {
	description: 'Create a JSON backup of a channel and all its tracks',

	options: {
		output: {
			type: 'string',
			description: 'Save backup to a file path instead of stdout'
		}
	},

	async run(argv) {
		const {values, positionals} = parse(argv, this.options)
		const slug = positionals[0]
		if (!slug) throw new Error('Channel slug is required')
		const backup = await createChannelBackup(slug)
		const json = JSON.stringify(backup, null, 2)

		if (values.output) {
			const {writeFile} = await import('node:fs/promises')
			await writeFile(values.output, json, 'utf8')
			return `Backup saved to ${values.output}`
		}

		return json
	},

	examples: [
		'r4 channel backup ko002',
		'r4 channel backup ko002 > ko002-backup.json',
		'r4 channel backup ko002 --output ko002-backup.json'
	]
}
