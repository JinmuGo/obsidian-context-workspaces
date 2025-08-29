import {
	ErrorType,
	safeExecute,
	safeExecuteWithRetry,
	validateData,
} from '../src/utils/error-handling';
import { detectAndCleanupMemoryLeaks, getMemoryInfo } from '../src/utils/memory-management';
import {
	debounce,
	performanceMonitor,
	throttle,
	withPerformanceMeasurement,
} from '../src/utils/performance-monitor';
import {
	sanitizeSpaceName,
	sanitizeString,
	validateSettings,
	validateSpaceConfig,
	validateString,
} from '../src/utils/validation';

// Type definitions for testing
interface PerformanceMemory {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
	memory?: PerformanceMemory;
}

describe('Stability Tests', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('Input Validation', () => {
		test('validateString with valid input', () => {
			const result = validateString('test', { minLength: 1, maxLength: 10 });
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		test('validateString with invalid input', () => {
			const result = validateString('', { required: true });
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Value is required');
		});

		test('validateString with wrong type', () => {
			const result = validateString(123, { required: true });
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Value must be a string');
		});

		test('validateString with pattern', () => {
			const result = validateString('test123', { pattern: /^[a-z]+$/ });
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Value does not match required pattern');
		});

		test('validateSpaceConfig with valid config', () => {
			const config = {
				name: 'Test Space',
				icon: '🚀',
				autoSave: true,
			};
			expect(validateSpaceConfig(config)).toBe(true);
		});

		test('validateSpaceConfig with invalid config', () => {
			const config = {
				name: 'Test Space',
				icon: '🚀',
				// Missing autoSave
			};
			expect(validateSpaceConfig(config)).toBe(false);
		});

		test('validateSettings with valid settings', () => {
			const settings = {
				spaces: {
					'test-space': {
						name: 'Test Space',
						icon: '🚀',
						autoSave: true,
					},
				},
				spaceOrder: ['test-space'],
				currentSpaceId: 'test-space',
			};
			expect(validateSettings(settings)).toBe(true);
		});

		test('validateSettings with invalid settings', () => {
			const settings = {
				spaces: {},
				spaceOrder: 'not-an-array',
				currentSpaceId: 'test-space',
			};
			expect(validateSettings(settings)).toBe(false);
		});
	});

	describe('Input Sanitization', () => {
		test('sanitizeString removes extra spaces', () => {
			expect(sanitizeString('  test   string  ')).toBe('test string');
		});

		test('sanitizeSpaceName removes special characters', () => {
			expect(sanitizeSpaceName('Test@#$%^&*()Space')).toBe('TestSpace');
		});

		test('sanitizeSpaceName preserves valid characters', () => {
			expect(sanitizeSpaceName('Test-Space 123')).toBe('Test-Space 123');
		});
	});

	describe('Error Handling', () => {
		test('safeExecute with successful operation', async () => {
			const result = await safeExecute(
				() => Promise.resolve('success'),
				ErrorType.DATA_VALIDATION
			);
			expect(result).toBe('success');
		});

		test('safeExecute with failed operation', async () => {
			const result = await safeExecute(
				() => Promise.reject(new Error('test error')),
				ErrorType.DATA_VALIDATION
			);
			expect(result).toBeUndefined();
		});

		test('safeExecuteWithRetry with successful retry', async () => {
			let attempts = 0;
			const result = await safeExecuteWithRetry(
				() => {
					attempts++;
					if (attempts < 3) {
						throw new Error('temporary error');
					}
					return Promise.resolve('success');
				},
				ErrorType.DATA_VALIDATION,
				3,
				10
			);
			expect(result).toBe('success');
			expect(attempts).toBe(3);
		});

		test('safeExecuteWithRetry with fallback', async () => {
			const result = await safeExecuteWithRetry(
				() => Promise.reject(new Error('persistent error')),
				ErrorType.DATA_VALIDATION,
				2,
				10,
				'fallback'
			);
			expect(result).toBe('fallback');
		});

		test('validateData with valid data', () => {
			const validator = (data: unknown): data is string => typeof data === 'string';
			const result = validateData('test', validator);
			expect(result).toBe('test');
		});

		test('validateData with invalid data', () => {
			const validator = (data: unknown): data is string => typeof data === 'string';
			const result = validateData(123, validator);
			expect(result).toBeNull();
		});
	});

	describe('Memory Management', () => {
		test('getMemoryInfo returns null when memory API not available', () => {
			// Mock performance.memory as undefined
			const originalMemory = (performance as ExtendedPerformance).memory;
			delete (performance as ExtendedPerformance).memory;

			const result = getMemoryInfo();
			expect(result).toBeNull();

			// Restore original
			(performance as ExtendedPerformance).memory = originalMemory;
		});

		test('detectAndCleanupMemoryLeaks does not throw', () => {
			expect(() => detectAndCleanupMemoryLeaks()).not.toThrow();
		});
	});

	describe('Performance Monitoring', () => {
		test('performanceMonitor measures function execution', async () => {
			const result = await performanceMonitor.measure('test', () =>
				Promise.resolve('success')
			);
			expect(result).toBe('success');

			const stats = performanceMonitor.getStatistics();
			expect(stats.count).toBeGreaterThan(0);
		});

		test('debounce delays function execution', (done) => {
			let callCount = 0;
			const debouncedFn = debounce(() => {
				callCount++;
				expect(callCount).toBe(1);
				done();
			}, 10);

			debouncedFn();
			debouncedFn();
			debouncedFn();
		});

		test('throttle limits function execution', (done) => {
			let callCount = 0;
			const throttledFn = throttle(() => {
				callCount++;
			}, 100);

			throttledFn();
			throttledFn();
			throttledFn();

			setTimeout(() => {
				expect(callCount).toBe(1);
				done();
			}, 50);
		});

		test('withPerformanceMeasurement wraps function', async () => {
			const wrappedFn = withPerformanceMeasurement('test', () => Promise.resolve('success'));
			const result = await wrappedFn();
			expect(result).toBe('success');
		});
	});

	describe('Edge Cases', () => {
		test('validateString with null input', () => {
			const result = validateString(null, { required: true });
			expect(result.isValid).toBe(false);
		});

		test('validateString with undefined input', () => {
			const result = validateString(undefined, { required: true });
			expect(result.isValid).toBe(false);
		});

		test('safeExecute with synchronous function', async () => {
			const result = await safeExecute(() => 'sync result', ErrorType.DATA_VALIDATION);
			expect(result).toBe('sync result');
		});

		test('performanceMonitor with throwing function', () => {
			expect(() => {
				performanceMonitor.measure('test', () => {
					throw new Error('test error');
				});
			}).toThrow('test error');

			const failedOps = performanceMonitor.getFailedOperations();
			expect(failedOps.length).toBeGreaterThan(0);
		});
	});

	describe('Performance Statistics', () => {
		test('performanceMonitor tracks slow operations', async () => {
			await performanceMonitor.measure('slow', () => {
				return new Promise((resolve) => setTimeout(resolve, 150));
			});

			const slowOps = performanceMonitor.getSlowOperations();
			expect(slowOps.length).toBeGreaterThan(0);
		});

		test('performanceMonitor clears results', () => {
			performanceMonitor.clear();
			const stats = performanceMonitor.getStatistics();
			expect(stats.count).toBe(0);
		});
	});
});
