/**
 * Memory management utilities for monitoring and cleanup
 */

/**
 * Memory usage information
 */
export interface MemoryInfo {
	used: number;
	total: number;
	limit: number;
	percentage: number;
}

// Chrome DevTools Protocol memory API type definitions
interface PerformanceMemory {
	usedJSHeapSize: number;
	totalJSHeapSize: number;
	jsHeapSizeLimit: number;
}

interface ExtendedPerformance extends Performance {
	memory?: PerformanceMemory;
}

interface ExtendedWindow extends Window {
	gc?: () => void;
}

/**
 * Get current memory usage information
 */
export function getMemoryInfo(): MemoryInfo | null {
	// Use Chrome DevTools Protocol memory API
	const memory = (performance as ExtendedPerformance).memory;
	if (!memory) {
		return null;
	}

	const used = memory.usedJSHeapSize;
	const total = memory.totalJSHeapSize;
	const limit = memory.jsHeapSizeLimit;
	const percentage = (used / limit) * 100;

	return {
		used,
		total,
		limit,
		percentage,
	};
}

/**
 * Memory monitor for tracking memory usage
 */
export class MemoryMonitor {
	private memoryThreshold = 0.8; // 80% threshold
	private checkInterval: NodeJS.Timeout | null = null;
	private isMonitoring = false;

	startMonitoring(intervalMs = 30000): void {
		if (this.isMonitoring) {
			return;
		}

		this.isMonitoring = true;
		this.checkInterval = setInterval(() => {
			this.checkMemoryUsage();
		}, intervalMs);
	}

	stopMonitoring(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
		this.isMonitoring = false;
	}

	private checkMemoryUsage(): void {
		const memoryInfo = getMemoryInfo();
		if (memoryInfo && memoryInfo.percentage > this.memoryThreshold * 100) {
			console.warn(
				`High memory usage detected: ${memoryInfo.percentage.toFixed(2)}% (${(
					memoryInfo.used /
					1024 /
					1024
				).toFixed(2)}MB / ${(memoryInfo.limit / 1024 / 1024).toFixed(2)}MB)`
			);
		}
	}

	setThreshold(threshold: number): void {
		this.memoryThreshold = Math.max(0, Math.min(1, threshold));
	}
}

/**
 * Resource manager for cleanup
 */
export class ResourceManager {
	private resources: Array<{ id: string; cleanup: () => void }> = [];

	register(id: string, cleanup: () => void): void {
		this.resources.push({ id, cleanup });
	}

	unregister(id: string): void {
		const index = this.resources.findIndex((r) => r.id === id);
		if (index !== -1) {
			this.resources.splice(index, 1);
		}
	}

	cleanup(): void {
		this.resources.forEach((resource) => {
			try {
				resource.cleanup();
			} catch (error) {
				console.error(`Failed to cleanup resource ${resource.id}:`, error);
			}
		});
		this.resources = [];
	}

	getResourceCount(): number {
		return this.resources.length;
	}
}

/**
 * Event listener manager
 */
export class EventListenerManager {
	private listeners: Array<{
		element: EventTarget;
		event: string;
		listener: EventListener;
		options?: AddEventListenerOptions;
	}> = [];

	addListener(
		element: EventTarget,
		event: string,
		listener: EventListener,
		options?: AddEventListenerOptions
	): void {
		element.addEventListener(event, listener, options);
		this.listeners.push({ element, event, listener, options });
	}

	removeListener(
		element: EventTarget,
		event: string,
		listener: EventListener,
		options?: AddEventListenerOptions
	): void {
		element.removeEventListener(event, listener, options);
		const index = this.listeners.findIndex(
			(l) => l.element === element && l.event === event && l.listener === listener
		);
		if (index !== -1) {
			this.listeners.splice(index, 1);
		}
	}

	cleanup(): void {
		this.listeners.forEach(({ element, event, listener, options }) => {
			element.removeEventListener(event, listener, options);
		});
		this.listeners = [];
	}

	getListenerCount(): number {
		return this.listeners.length;
	}
}

/**
 * Timer manager
 */
export class TimerManager {
	private timers: Array<{ id: NodeJS.Timeout; description: string }> = [];

	setTimeout(callback: () => void, delay: number, description = 'Unknown'): NodeJS.Timeout {
		const id = setTimeout(() => {
			callback();
			this.removeTimer(id);
		}, delay);
		this.timers.push({ id, description });
		return id;
	}

	setInterval(callback: () => void, delay: number, description = 'Unknown'): NodeJS.Timeout {
		const id = setInterval(callback, delay);
		this.timers.push({ id, description });
		return id;
	}

	clearTimeout(id: NodeJS.Timeout): void {
		clearTimeout(id);
		this.removeTimer(id);
	}

	clearInterval(id: NodeJS.Timeout): void {
		clearInterval(id);
		this.removeTimer(id);
	}

	private removeTimer(id: NodeJS.Timeout): void {
		const index = this.timers.findIndex((t) => t.id === id);
		if (index !== -1) {
			this.timers.splice(index, 1);
		}
	}

	cleanup(): void {
		this.timers.forEach(({ id }) => {
			clearTimeout(id);
			clearInterval(id);
		});
		this.timers = [];
	}

	getTimerCount(): number {
		return this.timers.length;
	}
}

// Global instances
export const globalResourceManager = new ResourceManager();
export const globalEventListenerManager = new EventListenerManager();
export const globalTimerManager = new TimerManager();
export const memoryMonitor = new MemoryMonitor();

/**
 * Cleanup all global resources
 */
export function cleanupGlobalResources(): void {
	globalResourceManager.cleanup();
	globalEventListenerManager.cleanup();
	globalTimerManager.cleanup();
	memoryMonitor.stopMonitoring();
}

/**
 * Detect and cleanup memory leaks
 */
export function detectAndCleanupMemoryLeaks(): void {
	const memoryInfo = getMemoryInfo();
	if (memoryInfo && memoryInfo.percentage > 90) {
		console.warn('Memory usage is very high, performing cleanup...');
		cleanupGlobalResources();
		
		// Force garbage collection if available
		if (typeof window !== 'undefined' && (window as ExtendedWindow).gc) {
			(window as ExtendedWindow).gc?.();
		}
	}
}

/**
 * Cleanup on page unload
 */
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		cleanupGlobalResources();
	});

	// Start memory monitoring
	memoryMonitor.startMonitoring();
} 
