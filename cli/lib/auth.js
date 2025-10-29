import {sdk} from '@radio4000/sdk'
import * as config from './config.js'

/**
 * Save authentication session to config
 */
export async function saveSession(session) {
	const sessionData = {
		access_token: session.access_token,
		refresh_token: session.refresh_token,
		expires_at: session.expires_at,
		user: {
			id: session.user.id,
			email: session.user.email
		},
		created_at: new Date().toISOString()
	}

	await config.update({
		auth: {
			session: sessionData
		}
	})

	return sessionData
}

/**
 * Load authentication session from config
 */
export async function loadSession() {
	const data = await config.load()
	return data.auth?.session || null
}

/**
 * Clear saved authentication session
 */
export async function clearSession() {
	await config.update({
		auth: {
			session: null
		}
	})
	return true
}

/**
 * Check if session is expired
 */
export function isSessionExpired(session) {
	if (!session?.expires_at) return true
	return Date.now() / 1000 > session.expires_at
}

/**
 * Get valid session (auto-refresh if needed)
 */
export async function getValidSession() {
	const session = await loadSession()
	if (!session) return null

	// If not expired, use as-is
	if (!isSessionExpired(session)) {
		return session
	}

	// Try to refresh
	const {data, error} = await sdk.supabase.auth.setSession({
		access_token: session.access_token,
		refresh_token: session.refresh_token
	})

	if (error || !data.session) {
		// Refresh failed, clear invalid session
		await clearSession()
		return null
	}

	// Save refreshed session
	await saveSession(data.session)
	return data.session
}

/**
 * Get current authenticated user (returns null if not logged in)
 */
export async function getCurrentUser() {
	const session = await getValidSession()
	if (!session) return null

	const {data, error} = await sdk.supabase.auth.getUser(session.access_token)
	if (error) return null

	return data.user
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
	const session = await getValidSession()
	return session !== null
}
