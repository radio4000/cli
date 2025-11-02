import {readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default {
	description: 'Show version information',

	async run() {
		const pkgPath = resolve(__dirname, '../../package.json')
		const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
		return `r4 v${pkg.version}`
	}
}
