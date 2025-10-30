import * as config from './config.js'

export async function saveSession(session) {
	await config.update({auth: {session}})
}

export async function loadSession() {
	const data = await config.load()
	return data.auth?.session || null
}

export async function clearSession() {
	await config.update({auth: {session: null}})
}
