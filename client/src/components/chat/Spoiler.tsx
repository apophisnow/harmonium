import { useState } from 'react';

interface SpoilerProps {
  children: React.ReactNode;
}

export function Spoiler({ children }: SpoilerProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      className={`rounded px-0.5 cursor-pointer transition-all duration-200 ${
        revealed
          ? 'bg-th-bg-secondary text-inherit'
          : 'bg-th-text-primary text-transparent select-none'
      }`}
      onClick={() => setRevealed((r) => !r)}
      role="button"
      aria-label={revealed ? 'Hide spoiler' : 'Reveal spoiler'}
    >
      {children}
    </span>
  );
}
