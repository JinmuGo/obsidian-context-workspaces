/**
 * Performance monitoring utilities
 */

/**
 * Performance measurement result
 */
export interface PerformanceResult {
	name: string;
	duration: number;
	timestamp: number;
	success: boolean;
	error?: string;
}

/**
 * Performance statistics
 */
export interface PerformanceStats {
	count: number;
	averageDuration: number;
	minDuration: number;
	maxDuration: number;
	slowOperations: number;
	errorCount: number;
}

/**
 * Performance monitor for tracking function execution times
 */
export class PerformanceMonitor {
	private results: PerformanceResult[] = [];
	private maxResults = 1000;
	private slowThreshold = 100; // ms

	/**
	 * Measure function execution time
	 */
	measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
		const start = performance.now();
		const timestamp = Date.now();

		try {
			const result = fn();

			if (result instanceof Promise) {
				return result
					.then((value) => {
						this.recordResult(name, performance.now() - start, timestamp, true);
						return value;
					})
					.catch((error) => {
						this.recordResult(
							name,
							performance.now() - start,
							timestamp,
							false,
							error.message
						);
						throw error;
					});
			}
			this.recordResult(name, performance.now() - start, timestamp, true);
			return result;
		} catch (error) {
			this.recordResult(
				name,
				performance.now() - start,
				timestamp,
				false,
				error instanceof Error ? error.message : String(error)
			);
			throw error;
		}
	}

	/**
	 * Record performance result
	 */
	private recordResult(
		name: string,
		duration: number,
		timestamp: number,
		success: boolean,
		error?: string
	): void {
		const result: PerformanceResult = {
			name,
			duration,
			timestamp,
			success,
			error,
		};

		this.results.push(result);

		// Keep only the latest results
		if (this.results.length > this.maxResults) {
			this.results = this.results.slice(-this.maxResults);
		}

		// Log slow operations
		if (duration > this.slowThreshold) {
			console.warn(`Slow operation detected: ${name} (${duration.toFixed(2)}ms)`);
		}
	}

	/**
	 * Get performance statistics
	 */
	getStatistics(): PerformanceStats {
		if (this.results.length === 0) {
			return {
				count: 0,
				averageDuration: 0,
				minDuration: 0,
				maxDuration: 0,
				slowOperations: 0,
				errorCount: 0,
			};
		}

		const durations = this.results.map((r) => r.duration);
		const slowOperations = this.results.filter((r) => r.duration > this.slowThreshold).length;
		const errorCount = this.results.filter((r) => !r.success).length;

		return {
			count: this.results.length,
			averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
			minDuration: Math.min(...durations),
			maxDuration: Math.max(...durations),
			slowOperations,
			errorCount,
		};
	}

	/**
	 * Get results by name
	 */
	getResultsByName(name: string): PerformanceResult[] {
		return this.results.filter((r) => r.name === name);
	}

	/**
	 * Get slow operations
	 */
	getSlowOperations(): PerformanceResult[] {
		return this.results.filter((r) => r.duration > this.slowThreshold);
	}

	/**
	 * Get failed operations
	 */
	getFailedOperations(): PerformanceResult[] {
		return this.results.filter((r) => !r.success);
	}

	/**
	 * Clear all results
	 */
	clear(): void {
		this.results = [];
	}

	/**
	 * Set slow operation threshold
	 */
	setSlowThreshold(threshold: number): void {
		this.slowThreshold = threshold;
	}
}

export const performanceMonitor = new PerformanceMonitor();

/**
 * Performance measurement decorator
 * Apply to class methods to measure execution time
 */
export function measurePerformance(name: string) {
	return <T extends (...args: unknown[]) => unknown>(
		_target: object,
		propertyKey: string,
		descriptor: TypedPropertyDescriptor<T>
	) => {
		const originalMethod = descriptor.value;

		descriptor.value = function (...args: unknown[]) {
			if (!originalMethod) {
				throw new Error('Original method is undefined');
			}
			return performanceMonitor.measure(`${name}.${propertyKey}`, () =>
				originalMethod.apply(this, args)
			);
		} as T;
		return descriptor;
	};
}

/**
 * Performance measurement function wrapper
 */
export function withPerformanceMeasurement<T extends (...args: unknown[]) => unknown>(
	name: string,
	fn: T
): T {
	return ((...args: unknown[]) => {
		return performanceMonitor.measure(name, () => fn(...args));
	}) as T;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: NodeJS.Timeout | null = null;
	return (...args: Parameters<T>) => {
		if (timeout) {
			clearTimeout(timeout);
		}
		timeout = setTimeout(() => func(...args), wait);
	};
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean = false;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}

/**
 * Asynchronous task queue
 */
export class AsyncQueue {
	private queue: Array<() => Promise<void>> = [];
	private running = 0;
	private maxConcurrent: number;

	constructor(maxConcurrent = 1) {
		this.maxConcurrent = maxConcurrent;
	}

	/**
	 * Add task to queue
	 */
	async add(task: () => Promise<void>): Promise<void> {
		return new Promise((resolve, reject) => {
			this.queue.push(async () => {
				try {
					await task();
					resolve();
				} catch (error) {
					reject(error);
				}
			});
			this.process();
		});
	}

	/**
	 * Process queue
	 */
	private async process(): Promise<void> {
		if (this.running >= this.maxConcurrent || this.queue.length === 0) {
			return;
		}

		this.running++;
		const task = this.queue.shift();
		if (task) {
			try {
				await task();
			} finally {
				this.running--;
				this.process();
			}
		}
	}

	/**
	 * Get queue length
	 */
	getLength(): number {
		return this.queue.length;
	}

	/**
	 * Get running count
	 */
	getRunningCount(): number {
		return this.running;
	}

	/**
	 * Clear queue
	 */
	clear(): void {
		this.queue = [];
	}
}

export const globalAsyncQueue = new AsyncQueue(3);

/**
 * Measure performance of a function
 */
export function measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
	return performanceMonitor.measure(name, fn);
}

/**
 * Create a debounced version of a function
 */
export function createDebounced<T extends (...args: unknown[]) => unknown>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	return debounce(fn, delay);
}

/**
 * Create a throttled version of a function
 */
export function createThrottled<T extends (...args: unknown[]) => unknown>(
	fn: T,
	limit: number
): (...args: Parameters<T>) => void {
	return throttle(fn, limit);
}
