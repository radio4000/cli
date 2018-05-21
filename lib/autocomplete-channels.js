const prompts = require('prompts')
const {findChannels} = require('radio4000-sdk')

const main = async function() {
	const channels = await findChannels()
	const answer = await prompts({
		type: 'autocomplete',
		name: 'slug',
		message: 'Select a radio',
		choices: channels.map(c => ({
			title: c.title,
			value: c.slug
		}))
	})
	return answer.slug
}

module.exports = main
