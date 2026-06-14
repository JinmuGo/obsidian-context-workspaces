import {
	EMOJI_PICKER_TAG,
	resolveEmojiPickerConstructor,
} from '../src/components/emoji-picker-element';

/**
 * Regression tests for issue #4: changing the icon produced a blank screen with
 * "Failed to construct 'HTMLElement': Illegal constructor".
 *
 * Tests run in declaration order. The first test must run while the tag is
 * still unregistered, so do not import emoji-mart (or EmojiPicker) in this file.
 */
describe('resolveEmojiPickerConstructor (issue #4)', () => {
	it('returns the fallback before the picker tag is registered (first load)', () => {
		class FreshPicker extends HTMLElement {}

		expect(customElements.get(EMOJI_PICKER_TAG)).toBeUndefined();
		expect(resolveEmojiPickerConstructor(FreshPicker)).toBe(FreshPicker);
	});

	it('resolves to the registered constructor, not a stale bundled class (reload)', () => {
		// A previous plugin load registered the tag with this class.
		class RegisteredPicker extends HTMLElement {
			constructor(_props?: unknown) {
				super();
			}
		}
		// A fresh plugin load produces a brand new class. Obsidian keeps the
		// renderer page alive, so define() is skipped and this class is NOT in
		// the registry.
		class StalePicker extends HTMLElement {}

		customElements.define(EMOJI_PICKER_TAG, RegisteredPicker);

		// Reproduce the crash: constructing the unregistered class throws. Chromium
		// (Obsidian) reports "Illegal constructor"; jsdom reports "not part of the
		// custom element registry" — same root cause, different wording.
		expect(() => new StalePicker()).toThrow(
			/Illegal constructor|not part of the custom element registry/
		);

		// The fix picks the registered constructor instead of the stale one...
		const Ctor = resolveEmojiPickerConstructor(
			StalePicker as unknown as CustomElementConstructor
		);
		expect(Ctor).toBe(RegisteredPicker);

		// ...and constructing it no longer throws.
		expect(() => new Ctor()).not.toThrow();
	});
});
