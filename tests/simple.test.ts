// Simple tests
describe('Basic tests', () => {
	test('1 + 1 = 2', () => {
		expect(1 + 1).toBe(2);
	});

	test('String encoding test', () => {
		const testString = 'Project Alpha';
		expect(testString).toBe('Project Alpha');
		expect(testString.length).toBe(13);
	});

	test('UTF-8 encoding test', () => {
		const testString = 'Project Alpha';
		const utf8Bytes = new TextEncoder().encode(testString);
		const decodedString = new TextDecoder('utf-8').decode(utf8Bytes);

		expect(decodedString).toBe(testString);
		expect(utf8Bytes.length).toBeGreaterThan(0);
	});
});
