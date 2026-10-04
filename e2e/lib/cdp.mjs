// Minimal Chrome DevTools Protocol client over Node's built-in WebSocket.

export async function listPages(port) {
	const response = await fetch(`http://127.0.0.1:${port}/json`);
	const targets = await response.json();
	return targets.filter((target) => target.type === 'page');
}

export class Page {
	constructor(target) {
		this.target = target;
		this.nextId = 1;
		this.pending = new Map();
		this.socket = null;
	}

	async connect() {
		if (this.socket?.readyState === WebSocket.OPEN) {
			return;
		}
		const socket = new WebSocket(this.target.webSocketDebuggerUrl);
		await new Promise((resolve, reject) => {
			socket.addEventListener('open', resolve, { once: true });
			socket.addEventListener('error', reject, { once: true });
		});
		socket.addEventListener('message', (event) => {
			const message = JSON.parse(event.data);
			const request = this.pending.get(message.id);
			if (!request) {
				return;
			}
			this.pending.delete(message.id);
			if (message.error) {
				request.reject(new Error(`${message.error.message} (${request.method})`));
			} else {
				request.resolve(message.result);
			}
		});
		socket.addEventListener('close', () => {
			for (const request of this.pending.values()) {
				request.reject(new Error(`CDP connection closed (${request.method})`));
			}
			this.pending.clear();
		});
		this.socket = socket;
	}

	async send(method, params = {}) {
		await this.connect();
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject, method });
			this.socket.send(JSON.stringify({ id, method, params }));
		});
	}

	/** Evaluate an expression in the page and return its JSON value. Promises are awaited. */
	async eval(expression) {
		const result = await this.send('Runtime.evaluate', {
			expression,
			awaitPromise: true,
			returnByValue: true,
		});
		if (result.exceptionDetails) {
			const description =
				result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
			throw new Error(`Page error: ${description}`);
		}
		return result.result.value;
	}

	/** Pretend the OS colour scheme is light or dark. Lasts while this connection is open. */
	async emulateColorScheme(scheme) {
		await this.send('Emulation.setEmulatedMedia', {
			features: [{ name: 'prefers-color-scheme', value: scheme }],
		});
	}

	close() {
		this.socket?.close();
		this.socket = null;
	}
}
