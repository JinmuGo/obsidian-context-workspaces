import {
	PerformanceMonitor,
	AsyncQueue,
	debounce,
	throttle,
} from '../src/utils/performance-monitor';

describe('PerformanceMonitor', () => {
	let monitor: PerformanceMonitor;

	beforeEach(() => {
		monitor = new PerformanceMonitor();
	});

	describe('measure', () => {
		test('should record synchronous function execution', () => {
			const result = monitor.measure('sync-test', () => 42);
			expect(result).toBe(42);

			const stats = monitor.getStatistics();
			expect(stats.count).toBe(1);
			expect(stats.errorCount).toBe(0);
		});

		test('should record async function execution', async () => {
			const result = await monitor.measure('async-test', async () => {
				return 'done';
			});
			expect(result).toBe('done');

			const stats = monitor.getStatistics();
			expect(stats.count).toBe(1);
			expect(stats.errorCount).toBe(0);
		});

		test('should record errors for failed sync functions', () => {
			expect(() => {
				monitor.measure('fail-sync', () => {
					throw new Error('sync error');
				});
			}).toThrow('sync error');

			const stats = monitor.getStatistics();
			expect(stats.count).toBe(1);
			expect(stats.errorCount).toBe(1);
		});

		test('should record errors for failed async functions', async () => {
			await expect(
				monitor.measure('fail-async', async () => {
					throw new Error('async error');
				})
			).rejects.toThrow('async error');

			const stats = monitor.getStatistics();
			expect(stats.count).toBe(1);
			expect(stats.errorCount).toBe(1);
		});

		test('should wrap non-Error throws in Error objects', async () => {
			await expect(
				monitor.measure('fail-string', async () => {
					throw 'string error';
				})
			).rejects.toThrow('string error');

			const failed = monitor.getFailedOperations();
			expect(failed).toHaveLength(1);
			expect(failed[0].error).toBe('string error');
		});
	});

	describe('getStatistics', () => {
		test('should return zero stats when empty', () => {
			const stats = monitor.getStatistics();
			expect(stats.count).toBe(0);
			expect(stats.averageDuration).toBe(0);
			expect(stats.minDuration).toBe(0);
			expect(stats.maxDuration).toBe(0);
		});

		test('should compute statistics across multiple measurements', () => {
			monitor.measure('op1', () => {});
			monitor.measure('op2', () => {});
			monitor.measure('op3', () => {});

			const stats = monitor.getStatistics();
			expect(stats.count).toBe(3);
			expect(stats.errorCount).toBe(0);
		});
	});

	describe('getResultsByName', () => {
		test('should filter results by name', () => {
			monitor.measure('alpha', () => {});
			monitor.measure('beta', () => {});
			monitor.measure('alpha', () => {});

			expect(monitor.getResultsByName('alpha')).toHaveLength(2);
			expect(monitor.getResultsByName('beta')).toHaveLength(1);
			expect(monitor.getResultsByName('gamma')).toHaveLength(0);
		});
	});

	describe('clear', () => {
		test('should reset all results', () => {
			monitor.measure('op', () => {});
			expect(monitor.getStatistics().count).toBe(1);

			monitor.clear();
			expect(monitor.getStatistics().count).toBe(0);
		});
	});

	describe('setSlowThreshold', () => {
		test('should detect slow operations with custom threshold', () => {
			monitor.setSlowThreshold(0); // everything is "slow"
			monitor.measure('op', () => {});

			expect(monitor.getSlowOperations()).toHaveLength(1);
		});
	});
});

describe('AsyncQueue', () => {
	test('should execute tasks sequentially by default', async () => {
		const queue = new AsyncQueue(1);
		const order: number[] = [];

		await Promise.all([
			queue.add(async () => {
				order.push(1);
			}),
			queue.add(async () => {
				order.push(2);
			}),
			queue.add(async () => {
				order.push(3);
			}),
		]);

		expect(order).toEqual([1, 2, 3]);
	});

	test('should handle task errors without breaking the queue', async () => {
		const queue = new AsyncQueue(1);

		await expect(
			queue.add(async () => {
				throw new Error('task failed');
			})
		).rejects.toThrow('task failed');

		// Queue should still work after error
		const result: string[] = [];
		await queue.add(async () => {
			result.push('recovered');
		});
		expect(result).toEqual(['recovered']);
	});

	test('should wrap non-Error rejections in Error objects', async () => {
		const queue = new AsyncQueue(1);

		await expect(
			queue.add(async () => {
				throw 'string rejection';
			})
		).rejects.toThrow('string rejection');
	});

	test('should report queue length and running count', async () => {
		const queue = new AsyncQueue(1);
		expect(queue.getLength()).toBe(0);
		expect(queue.getRunningCount()).toBe(0);
	});

	test('should clear the queue', () => {
		const queue = new AsyncQueue(1);
		queue.clear();
		expect(queue.getLength()).toBe(0);
	});

	test('should respect maxConcurrent', async () => {
		const queue = new AsyncQueue(2);
		let maxConcurrent = 0;
		let currentRunning = 0;

		const createTask = () => async () => {
			currentRunning++;
			maxConcurrent = Math.max(maxConcurrent, currentRunning);
			await new Promise((resolve) => setTimeout(resolve, 10));
			currentRunning--;
		};

		await Promise.all([
			queue.add(createTask()),
			queue.add(createTask()),
			queue.add(createTask()),
			queue.add(createTask()),
		]);

		expect(maxConcurrent).toBeLessThanOrEqual(2);
	});
});

describe('debounce', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('should delay function execution', () => {
		const fn = jest.fn();
		const debounced = debounce(fn, 100);

		debounced();
		expect(fn).not.toHaveBeenCalled();

		jest.advanceTimersByTime(100);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('should reset timer on subsequent calls', () => {
		const fn = jest.fn();
		const debounced = debounce(fn, 100);

		debounced();
		jest.advanceTimersByTime(50);
		debounced(); // reset
		jest.advanceTimersByTime(50);
		expect(fn).not.toHaveBeenCalled();

		jest.advanceTimersByTime(50);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('should pass arguments to the original function', () => {
		const fn = jest.fn();
		const debounced = debounce(fn, 100);

		debounced('arg1', 'arg2');
		jest.advanceTimersByTime(100);

		expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
	});
});

describe('throttle', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test('should execute immediately on first call', () => {
		const fn = jest.fn();
		const throttled = throttle(fn, 100);

		throttled();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('should block subsequent calls within limit', () => {
		const fn = jest.fn();
		const throttled = throttle(fn, 100);

		throttled();
		throttled();
		throttled();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	test('should allow calls after limit expires', () => {
		const fn = jest.fn();
		const throttled = throttle(fn, 100);

		throttled();
		jest.advanceTimersByTime(100);
		throttled();
		expect(fn).toHaveBeenCalledTimes(2);
	});
});
