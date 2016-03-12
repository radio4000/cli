const spawn = require('child_process').spawn;
const chalk = require('chalk');

const defaultOptions = [
	'--no-playlist',
	'--format=bestaudio[ext=m4a]/best[ext=mp4]/best',
	'--extract-audio',
	'--output=./downloads/%(title)s-%(id)s.%(ext)s',
	'--no-call-home',
	'--ignore-errors'
	// '--audio-quality 0',
	// 'max-downloads 1',
	// 'write-thumbnail ',
];

module.exports = (youtubeids, callback) => {
	const opts = defaultOptions.concat(youtubeids);
	const cmd = spawn('youtube-dl', opts);

	cmd.stdout.on('data', (data) => {
		console.log(`${data}`);
	});
	cmd.stderr.on('data', (data) => {
		console.log(chalk.red(`${data}`));
	});
	cmd.on('close', (code) => {
		// console.log('All done!');
		console.log(`child process exited with code ${code}`);
		callback(cmd);
	});
};
