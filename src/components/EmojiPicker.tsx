import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import type React from 'react';
import type { EmojiData } from '../types';

interface EmojiPickerProps {
	onEmojiSelect: (emoji: EmojiData) => void;
	theme?: 'light' | 'dark';
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, theme = 'light' }) => {
	return (
		<div className="obsidian-context-workspaces-emoji-picker-wrapper">
			<Picker
				data={data}
				theme={theme}
				onEmojiSelect={onEmojiSelect}
				set="native"
				previewPosition="none"
				skinTonePosition="none"
				searchPosition="top"
				emojiSize={20}
				perLine={8}
				maxFrequentRows={0}
				locale="ko"
				categories={[
					'frequent',
					'people',
					'nature',
					'foods',
					'activity',
					'places',
					'objects',
					'symbols',
					'flags',
				]}
			/>
		</div>
	);
};
