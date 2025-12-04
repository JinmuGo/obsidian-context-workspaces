// Jest test environment setup

import { TextDecoder, TextEncoder } from 'node:util';

// Global mocking setup
if (typeof global.TextEncoder === 'undefined') {
	global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
	// @ts-expect-error - TextDecoder types might not match exactly but good for polyfill
	global.TextDecoder = TextDecoder;
}

// DOM 환경 설정
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: jest.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(), // deprecated
		removeListener: jest.fn(), // deprecated
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});

// Console method mocking (control log output during tests)
global.console = {
	...console,
	// Hide unnecessary logs during tests
	log: jest.fn(),
	debug: jest.fn(),
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
};
