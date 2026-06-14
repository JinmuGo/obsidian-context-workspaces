import { DEFAULT_SPACE_ICON, formatStatusBarLabel } from '../src/utils/status-bar-utils';

describe('formatStatusBarLabel', () => {
	it('combines the space icon and name', () => {
		expect(formatStatusBarLabel({ icon: '🏠', name: 'My Space' })).toBe('🏠 My Space');
	});

	it('falls back to the default icon when none is set', () => {
		expect(formatStatusBarLabel({ icon: '', name: 'Work' })).toBe(
			`${DEFAULT_SPACE_ICON} Work`
		);
	});

	it('does not leave a trailing space when the name is empty', () => {
		expect(formatStatusBarLabel({ icon: '🚀', name: '' })).toBe('🚀');
	});
});
