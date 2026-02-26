import { useState, useEffect, useRef } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊',
      '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋',
      '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
      '🥴', '😵', '🤯', '🥳', '🥸', '😎', '🤓', '🧐',
    ],
  },
  {
    name: 'Hands',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '🫶', '👐',
      '🤲', '🤝', '🙏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈',
      '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '💪',
    ],
  },
  {
    name: 'Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💘', '💝',
    ],
  },
  {
    name: 'Objects',
    emojis: [
      '🔥', '⭐', '🌟', '✨', '💯', '💥', '🎉', '🎊', '🏆', '🥇',
      '🎯', '🎵', '🎶', '💡', '📌', '🔔', '🚀', '💎', '🪄', '🎮',
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      '✅', '❌', '⚠️', '❓', '❗', '💤', '♻️', '🔴', '🟢', '🔵',
      '⬆️', '⬇️', '➡️', '⬅️', '🔄', '➕', '➖',
    ],
  },
];

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full right-0 mb-2 z-50 w-[320px] rounded-lg bg-th-bg-floating shadow-xl border border-th-border"
    >
      {/* Category tabs */}
      <div className="flex border-b border-th-border px-2 pt-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            className={`px-2 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === i
                ? 'text-th-text-primary border-b-2 border-th-brand'
                : 'text-th-text-muted hover:text-th-text-secondary'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="p-2 max-h-[200px] overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="flex items-center justify-center h-8 w-8 rounded hover:bg-th-bg-accent transition-colors text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
