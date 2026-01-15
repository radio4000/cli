import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

const configPath = join(homedir(), '.config', 'radio4000', 'config.json')

const defaults = {
	auth: {session: null},
	// Base directory for all downloads (channels saved as subfolders)
	downloadsDir: null,
	// slskd connection settings (optional, defaults work for local Docker)
	soulseek: {
		host: 'localhost',
		port: 5030,
		username: 'slskd',
		password: 'slskd'
	}
}

/** Load config from disk, deep-merged with defaults */
export async function load() {
	try {
		const data = await readFile(configPath, 'utf-8')
		const userConfig = JSON.parse(data)
		// Deep merge so nested defaults (like soulseek.host) are preserved
		return {
			...defaults,
			...userConfig,
			soulseek: {...defaults.soulseek, ...userConfig.soulseek}
		}
	} catch (error) {
		if (error.code === 'ENOENT') {
			return defaults
		}
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

/** Update config with partial changes (deep merges auth and soulseek) */
export async function update(changes) {
	const config = await load()
	const merged = {
		...config,
		...changes,
		auth: changes.auth ? {...config.auth, ...changes.auth} : config.auth,
		soulseek: changes.soulseek
			? {...config.soulseek, ...changes.soulseek}
			: config.soulseek
	}
	return save(merged)
}
