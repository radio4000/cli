/*
How it works:
`this.#head` is an instance of `Node` which keeps track of its current value and nests another instance of `Node` that keeps the value that comes after it. When a value is provided to `.enqueue()`, the code needs to iterate through `this.#head`, going deeper and deeper to find the last value. However, iterating through every single item is slow. This problem is solved by saving a reference to the last value as `this.#tail` so that it can reference it to add a new value.
*/

class Node {
	value
	next

	constructor(value) {
		this.value = value
	}
}

class Queue {
	#head
	#tail
	#size

	constructor() {
		this.clear()
	}

	enqueue(value) {
		const node = new Node(value)

		if (this.#head) {
			this.#tail.next = node
			this.#tail = node
		} else {
			this.#head = node
			this.#tail = node
		}

		this.#size++
	}

	dequeue() {
		const current = this.#head
		if (!current) {
			return
		}

		this.#head = this.#head.next
		this.#size--
		return current.value
	}

	peek() {
		if (!this.#head) {
			return
		}

		return this.#head.value

		// TODO: Node.js 18.
		// return this.#head?.value;
	}

	clear() {
		this.#head = undefined
		this.#tail = undefined
		this.#size = 0
	}

	get size() {
		return this.#size
	}

	*[Symbol.iterator]() {
		let current = this.#head

		while (current) {
			yield current.value
			current = current.next
		}
	}

	*drain() {
		while (this.#head) {
			yield this.dequeue()
		}
	}
}

export default function pLimit(concurrency) {
	validateConcurrency(concurrency)

	const queue = new Queue()
	let activeCount = 0

	const resumeNext = () => {
		// Process the next queued function if we're under the concurrency limit
		if (activeCount < concurrency && queue.size > 0) {
			activeCount++
			queue.dequeue()()
		}
	}

	const next = () => {
		activeCount--
		resumeNext()
	}

	const run = async (function_, resolve, arguments_) => {
		// Execute the function and capture the result promise
		const result = (async () => function_(...arguments_))()

		// Resolve immediately with the promise (don't wait for completion)
		resolve(result)

		// Wait for the function to complete (success or failure)
		// We catch errors here to prevent unhandled rejections,
		// but the original promise rejection is preserved for the caller
		try {
			await result
		} catch {}

		// Decrement active count and process next queued function
		next()
	}

	const enqueue = (function_, resolve, arguments_) => {
		// Queue the internal resolve function instead of the run function
		// to preserve the asynchronous execution context.
		new Promise((internalResolve) => {
			// eslint-disable-line promise/param-names
			queue.enqueue(internalResolve)
		}).then(run.bind(undefined, function_, resolve, arguments_)) // eslint-disable-line promise/prefer-await-to-then

		// Start processing immediately if we haven't reached the concurrency limit
		if (activeCount < concurrency) {
			resumeNext()
		}
	}

	const generator = (function_, ...arguments_) =>
		new Promise((resolve) => {
			enqueue(function_, resolve, arguments_)
		})

	Object.defineProperties(generator, {
		activeCount: {
			get: () => activeCount
		},
		pendingCount: {
			get: () => queue.size
		},
		clearQueue: {
			value() {
				queue.clear()
			}
		},
		concurrency: {
			get: () => concurrency,

			set(newConcurrency) {
				validateConcurrency(newConcurrency)
				concurrency = newConcurrency

				queueMicrotask(() => {
					// eslint-disable-next-line no-unmodified-loop-condition
					while (activeCount < concurrency && queue.size > 0) {
						resumeNext()
					}
				})
			}
		},
		map: {
			async value(iterable, function_) {
				const promises = Array.from(iterable, (value, index) =>
					this(function_, value, index)
				)
				return Promise.all(promises)
			}
		}
	})

	return generator
}

export function limitFunction(function_, options) {
	const {concurrency} = options
	const limit = pLimit(concurrency)

	return (...arguments_) => limit(() => function_(...arguments_))
}

function validateConcurrency(concurrency) {
	if (
		!(
			(Number.isInteger(concurrency) ||
				concurrency === Number.POSITIVE_INFINITY) &&
			concurrency > 0
		)
	) {
		throw new TypeError('Expected `concurrency` to be a number from 1 and up')
	}
}
