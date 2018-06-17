const spawn = require('child_process').spawn
const chalk = require('chalk')

module.exports = (youtubeids, downloadFolderName) => {
	const defaultOptions = [
		'--no-playlist', // If URL points to a video in a playlist, only take the video
		'--no-warnings',
		'--format=bestaudio[ext=m4a]/best[ext=mp4]/best',
		'--extract-audio',
		`--output=./${downloadFolderName}/%(title)s-%(id)s.%(ext)s`,
		'--no-call-home',
		'--ignore-errors', // Continue on errors
		'--audio-quality=0',
		'--add-metadata'
		// 'write-thumbnail ',
	]
	const opts = defaultOptions.concat(youtubeids)

	return new Promise(resolve => {
		const cmd = spawn('youtube-dl', opts)
		cmd.stdout.on('data', data => {
			console.log(`${data}`)
		})

		cmd.stderr.on('data', data => {
			console.log(chalk.red(`${data}`))
		})

		cmd.on('close', () => {
			resolve(cmd)
		})
	})
}
