const spawn = require("child_process").spawn;
const fs = require("fs");
const sanitizeFilename = require("sanitize-filename");
const { mediaUrlParser } = require("media-url-parser");
// const ffmetadata = require('ffmetadata')
// const getArtistTitle = require('get-artist-title')

/**
 * Downloads a list of tracks to local files
 * @param {Array<object>} tracks
 * @param {string} folder
 * @param {object} options
 * @prop {boolean} options.debug
 * @prop {boolean} options.dryrun - don't download anything
 * @prop {object} options.forceDownload
 * @returns
 */
const downloadTracks = async (
	tracks,
	folder,
	{ dryrun, debug, forceDownload }
) => {
	// Add a few more properties to the tracks.
	tracks = tracks.map(track => {
		track.filename = sanitizeFilename(track.title);
		const parsedTrack = mediaUrlParser(track.url);
		track.extension = parsedTrack.provider === "soundcloud" ? "wav" : "m4a";
		track.destination = `./${folder}/${track.filename}.${track.extension}`;
		track.fileExists = fs.existsSync(track.destination);
		return track;
	});

	// Get an overview
	const notAvailable = tracks.filter(t => t.mediaNotAvailable);
	const alreadyDownloaded = tracks.filter(t => t.fileExists);
	const toDownload = tracks.filter(t => !t.mediaNotAvailable && !t.fileExists);
	console.log("- total tracks", tracks.length);
	console.log("- track media not available", notAvailable.length);
	console.log("- tracks already downloaded", alreadyDownloaded.length);
	console.log("- tracks to download", toDownload.length);

	if (forceDownload) {
		debug &&
			console.log("--forceDownload is true, downloading all tracks anyway");
	}

	const failures = [];
	for (const track of toDownload) {
		try {
			if (!dryrun) {
				await downloadTrack(track.url, folder, track.filename, debug);
			} else if (debug) {
				console.log("would download", track.filename, track.url);
			}
		} catch (error) {
			console.log("Warning: could not download track", track.url, track.title);
			debug && console.error(error);
			failures.push({ track, error });
			// This is to skip the following code of this for loop occurence. So not add metadata etc.
			continue;
		}
	}
	console.log(
		`${failures.length}/${toDownload.length} failed to download. See ./${folder}/${folder}-logs.json for details.`
	);
	return {
		slug: folder,
		notAvailable,
		alreadyDownloaded,
		toDownload,
		failures
	};
};

/**
 * Saves a URL to a file
 * @param {string} url  - the url to download
 * @param {string} folder - the folder to save the file in, relative from where the script is run
 * @param {string} filename - the desired filename without extension
 * @param {boolean} debug
 * @returns
 */
const downloadTrack = (url, folder, filename, debug) => {
	const defaultOptions = [
		"--extract-audio", // audio-only
		// '--audio-format m4a',
		// '-f "ba[ext=m4a]/b[ext=mp4] / ba/b"',
		// '--audio-quality=0', // not specifying a quality should result in highest possible
		"--embed-metadata",
		"--quiet",
		"--no-playlist", // If URL points to a playlist, download only the video
		// '--no-warnings',
		`--format=bestaudio[ext=${"m4a"}]/best[ext=mp4]/best`,
		// '--ignore-errors', // Continue on errors
		`--paths=${folder}`,
		`--output=${filename}.%(ext)s`
	];

	// 	The combination of quiet and verbose makes sure we still get errors.
	// if (!debug) defaultOptions.push('--quiet', '--verbose')

	// Put media url to download at the end of the options
	const opts = defaultOptions.concat(url);

	return new Promise((resolve, reject) => {
		const cmd = spawn("yt-dlp", opts);
		cmd.stdout.on("data", data => {
			console.log("stdout", data.toString());
			// if (debug) console.log(`${data}`)
		});
		cmd.stderr.on("data", data => {
			// if (debug)  console.error(`${data}`)
			reject(data.toString());
		});
		cmd.on("close", () => {
			resolve(cmd);
		});
	});
};

module.exports = downloadTracks;
