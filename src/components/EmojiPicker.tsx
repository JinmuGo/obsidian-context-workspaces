import data from '@emoji-mart/data';
import { Picker } from 'emoji-mart';
import type React from 'react';
import { useEffect, useRef } from 'react';
import type { EmojiData } from '../types';
import { resolveEmojiPickerConstructor } from './emoji-picker-element';

interface EmojiPickerProps {
	onEmojiSelect: (emoji: EmojiData) => void;
	theme?: 'light' | 'dark';
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, theme = 'light' }) => {
	const containerRef = useRef<HTMLDivElement>(null);
	// Keep the latest callback without rebuilding the picker on every render.
	const onEmojiSelectRef = useRef(onEmojiSelect);
	useEffect(() => {
		onEmojiSelectRef.current = onEmojiSelect;
	});

	useEffect(() => {
		const parent = containerRef.current;
		if (!parent) {
			return;
		}

		// Instantiate the constructor that is actually registered for
		// <em-emoji-picker> rather than the freshly bundled `Picker` class.
		// See resolveEmojiPickerConstructor for why this avoids the
		// "Illegal constructor" crash after a plugin reload (issue #4).
		const PickerConstructor = resolveEmojiPickerConstructor(
			Picker as unknown as CustomElementConstructor
		);

		const instance = new PickerConstructor({
			data,
			theme,
			onEmojiSelect: (emoji: EmojiData) => onEmojiSelectRef.current(emoji),
			set: 'native',
			previewPosition: 'none',
			skinTonePosition: 'none',
			searchPosition: 'top',
			emojiSize: 20,
			perLine: 8,
			maxFrequentRows: 0,
			locale: 'ko',
			categories: [
				'frequent',
				'people',
				'nature',
				'foods',
				'activity',
				'places',
				'objects',
				'symbols',
				'flags',
			],
			parent,
		});

		return () => {
			instance.remove();
		};
	}, [theme]);

	return (
		<div ref={containerRef} className="obsidian-context-workspaces-emoji-picker-wrapper" />
	);
};
