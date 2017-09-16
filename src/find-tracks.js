/* global document */
const Nightmare = require('nightmare')

/**
 * Scrapes a Radio4000 channel page for it's tracks
 * and returns an array of their YouTube ids.
 */

const findTracks = url => {
	return (
		new Nightmare({show: false})
			.goto(url + '/tracks')
			.wait('.List')
			// Waiting for .Track is not reliable. Neither is this. But yea.
			// .wait(6000)
			.evaluate(() => {
				const elements = document.querySelectorAll('.Track')
				const ids = Array.from(elements)
					// YouTube IDs are stored as `data-pid` attributes.
					.map(e => e.getAttribute('data-pid'))
					// A full URL is needed, see
					// https://github.com/rg3/youtube-dl/#how-do-i-download-a-video-starting-with-a--
					.map(id => `http://www.youtube.com/watch?v=${id}`)
				return ids
			})
			.end()
	)
}

module.exports = findTracks
