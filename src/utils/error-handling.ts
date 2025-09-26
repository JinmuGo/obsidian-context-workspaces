import { Notice } from 'obsidian';

/**
 * Error types for different categories of errors
 */
export enum ErrorType {
	WORKSPACE_SYNC = 'workspace_sync',
	THEME_APPLICATION = 'theme_application',
	SIDEBAR_RENDER = 'sidebar_render',
	SPACE_SWITCH = 'space_switch',
	DATA_VALIDATION = 'data_validation',
	OBSIDIAN_API = 'obsidian_api',
	REACT_RENDER = 'react_render',
	MEMORY_LEAK = 'memory_leak',
}

/**
 * Error information interface
 */
export interface ErrorInfo {
	type: ErrorType;
	message: string;
	timestamp: number;
	details?: Record<string, unknown>;
	stack?: string;
}

/**
 * Error logger for centralized error handling
 */
export class ErrorLogger {
	private errors: ErrorInfo[] = [];
	private maxErrors = 100;

	logError(
		type: ErrorType,
		message: string,
		details?: Record<string, unknown>,
		error?: Error
	): void {
		const errorInfo: ErrorInfo = {
			type,
			message,
			timestamp: Date.now(),
			details,
			stack: error?.stack,
		};

		this.errors.push(errorInfo);

		// Keep only the latest errors
		if (this.errors.length > this.maxErrors) {
			this.errors = this.errors.slice(-this.maxErrors);
		}

		console.error(`[${type}] ${message}`, details, error);
	}

	getErrors(): ErrorInfo[] {
		return [...this.errors];
	}

	clearErrors(): void {
		this.errors = [];
	}

	getErrorCount(): number {
		return this.errors.length;
	}
}

export const errorLogger = new ErrorLogger();

/**
 * Safe execution wrapper for functions
 */
export async function safeExecute<T>(
	fn: () => T | Promise<T>,
	errorType: ErrorType,
	fallback?: T,
	showNotice = false
): Promise<T | undefined> {
	try {
		return await fn();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		errorLogger.logError(errorType, message, undefined, error instanceof Error ? error : undefined);

		if (showNotice) {
			new Notice(`Error: ${message}`);
		}

		return fallback;
	}
}

/**
 * Safe execution with retry mechanism
 */
export async function safeExecuteWithRetry<T>(
	fn: () => T | Promise<T>,
	errorType: ErrorType,
	maxRetries = 3,
	delay = 1000,
	fallback?: T,
	showNotice = false
): Promise<T | undefined> {
	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			const message = `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`;
			errorLogger.logError(errorType, message, { attempt, maxRetries }, lastError);

			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, delay * attempt));
			}
		}
	}

	if (showNotice && lastError) {
		new Notice(`Failed after ${maxRetries} attempts: ${lastError.message}`);
	}

	return fallback;
}

/**
 * Data validation wrapper
 */
export function validateData<T>(
	data: unknown,
	validator: (data: unknown) => data is T,
	errorType: ErrorType = ErrorType.DATA_VALIDATION
): T | null {
	if (validator(data)) {
		return data;
	}

	errorLogger.logError(errorType, 'Data validation failed', { data });
	return null;
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

/**
 * Detect memory leaks and cleanup
 */
export function detectMemoryLeaks(): void {
	// Use Chrome DevTools Protocol memory API (only available in browser environment)
	const memoryInfo = (performance as ExtendedPerformance).memory;
	if (memoryInfo) {
		const usedMB = memoryInfo.usedJSHeapSize / 1024 / 1024;
		const totalMB = memoryInfo.totalJSHeapSize / 1024 / 1024;
		const limitMB = memoryInfo.jsHeapSizeLimit / 1024 / 1024;
		if (usedMB / limitMB > 0.8) {
			errorLogger.logError(
				ErrorType.MEMORY_LEAK,
				`High memory usage detected: ${usedMB.toFixed(2)}MB / ${limitMB.toFixed(2)}MB`,
				{ usedMB, totalMB, limitMB }
			);
		}
	}
}
