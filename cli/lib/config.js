import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

const configPath = join(homedir(), '.config', 'radio4000', 'config.json')

const defaults = {
	auth: {session: null}
}

/** Load config from disk, return defaults if missing */
export async function load() {
	try {
		const data = await readFile(configPath, 'utf-8')
		return {...defaults, ...JSON.parse(data)}
	} catch (error) {
		// File doesn't exist yet - return defaults
		if (error.code === 'ENOENT') {
			return defaults
		}
		// File exists but we can't read/parse it - that's a real error
		throw new Error(
			`Failed to load config from ${configPath}: ${error.message}`
		)
	}
}

/** Save config to disk */
export async function save(config) {
	await mkdir(join(configPath, '..'), {recursive: true})
	await writeFile(configPath, JSON.stringify(config, null, 2))
	return config
}

/** Update config with partial changes (deep merges auth) */
export async function update(changes) {
	const config = await load()
	const merged = {
		...config,
		...changes,
		auth: changes.auth ? {...config.auth, ...changes.auth} : config.auth
	}
	return save(merged)
}
