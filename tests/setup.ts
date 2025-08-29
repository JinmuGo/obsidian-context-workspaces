// Jest test environment setup

// Global type declarations
declare global {
	var jest: {
		fn: () => jest.Mock;
	};
	var describe: (name: string, fn: () => void) => void;
	var test: (name: string, fn: () => void | Promise<void>) => void;
	var expect: (value: unknown) => jest.Matchers<void>;
	var beforeEach: (fn: () => void | Promise<void>) => void;
	var afterEach: (fn: () => void | Promise<void>) => void;
}

// Global mocking setup
if (typeof global.TextEncoder === 'undefined') {
	global.TextEncoder = require('node:util').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
	global.TextDecoder = require('node:util').TextDecoder;
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
