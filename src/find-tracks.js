/* global document */

const Nightmare = require('nightmare');

module.exports = url => {
	const n = new Nightmare({show: false})
		.goto(url)
		.wait('.Channel-outlet')
		.wait(6000) // Waiting for .Track is not reliable. Neither is this. But yea.
		// .wait('.Track')
		.evaluate(() => {
			return Array.from(document.querySelectorAll('.Track')).map(t => t.getAttribute('data-pid'));
		})
		.end();
	return n;
};
