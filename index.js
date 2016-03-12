const findTracks = require('./src/find-tracks');
const downloadTracks = require('./src/download-tracks');
const spawn = require('child_process').spawn;
const chalk = require('chalk');

const init = () => {
	const url = process.argv[2];

	if (!url) {
		console.log(chalk.red('You have to pass a valid and complete Radio4000 channel URL'));
		return;
	}

	console.log(chalk.yellow(`Fetching ${url} for you. This can take quite a while (~1-20 minutes)`));
	findTracks(url).then(ids => {
		const filteredIds = ids.filter(id => id.charAt(0) !== '-');
		downloadTracks(filteredIds, () => {
			console.log(chalk.green('All systems go. Check the `downloads` folder.'));
			spawn('open', ['downloads']);
		});
	});
};

init();

module.exports = init;
