/**
 * Tag name emoji-mart registers its picker web component under.
 */
export const EMOJI_PICKER_TAG = 'em-emoji-picker';

/**
 * Resolve the custom-element constructor that should be instantiated for the
 * emoji picker.
 *
 * emoji-mart registers `<em-emoji-picker>` via `customElements.define()` exactly
 * once per page (guarded by `!customElements.get()`). Obsidian never reloads the
 * renderer window when a plugin is toggled or updated, so that registration
 * survives across plugin reloads. After a reload the freshly bundled `Picker`
 * class is a *different* object than the one in the registry, and calling
 * `new FreshPicker()` throws:
 *
 *     TypeError: Failed to construct 'HTMLElement': Illegal constructor
 *
 * because, per the custom elements spec, `new` is only valid on the constructor
 * that is actually registered. This caused the blank screen reported in issue
 * #4. Always instantiate the constructor that lives in the registry, falling
 * back to the freshly bundled class on the very first load (before the
 * registration side effect has run for this page).
 */
export function resolveEmojiPickerConstructor(
	fallback: CustomElementConstructor
): CustomElementConstructor {
	return customElements.get(EMOJI_PICKER_TAG) ?? fallback;
}
