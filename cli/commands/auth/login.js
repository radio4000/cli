import {createInterface} from 'node:readline/promises'
import {sdk} from '@radio4000/sdk'
import * as config from '../../lib/config.js'
import {parse} from '../../utils.js'

export default {
	description: 'Authenticate with Radio4000 using email OTP',

	options: {
		email: {
			type: 'string',
			description: 'Email address to authenticate with'
		}
	},

	async run(argv) {
		const {values} = parse(argv, this.options)

		const rl = createInterface({
			input: process.stdin,
			output: process.stdout
		})

		try {
			// Get email (from flag or prompt)
			let email = values.email
			if (!email) {
				email = await rl.question('Email: ')
				email = email.trim()
			}

			if (!email || !email.includes('@')) {
				console.error('Invalid email address')
				return JSON.stringify({success: false})
			}

			// Step 1: Send OTP
			console.error(`Sending verification code to ${email}`)
			const {error: otpError} = await sdk.auth.signInWithOtp({
				email,
				options: {shouldCreateUser: false}
			})

			if (otpError) {
				console.error(`Error: ${otpError.message}`)
				return JSON.stringify({success: false, error: otpError.message})
			}

			console.error(
				'Verification code sent. Check your email for a 6-digit code.'
			)

			// Step 2: Prompt for code
			const code = await rl.question('Enter the 6-digit code: ')
			const trimmedCode = code.trim()

			if (!trimmedCode) {
				console.error('No code entered')
				return JSON.stringify({success: false})
			}

			// Step 3: Verify OTP
			console.error('Verifying code...')
			const {data: verifyData, error: verifyError} = await sdk.auth.verifyOtp({
				email,
				token: trimmedCode,
				type: 'email'
			})

			if (verifyError || !verifyData.session) {
				console.error(
					`Verification failed: ${verifyError?.message || 'Invalid or expired code'}`
				)
				return JSON.stringify({success: false, error: verifyError?.message})
			}

			// Step 4: Save session
			await config.update({auth: {session: verifyData.session}})

			console.error(`Authenticated as ${verifyData.session.user.email}`)
			console.error('Session saved to ~/.config/radio4000/config.json')

			return JSON.stringify(
				{
					success: true,
					user: {
						id: verifyData.session.user.id,
						email: verifyData.session.user.email
					},
					message: 'Authenticated successfully'
				},
				null,
				2
			)
		} finally {
			rl.close()
		}
	},

	examples: ['r4 auth login', 'r4 auth login --email "you@example.com"']
}
