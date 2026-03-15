import type { Embed } from '@harmonium/shared';

interface MessageEmbedProps {
  embed: Embed;
}

export function MessageEmbed({ embed }: MessageEmbedProps) {
  const borderColor = embed.color ?? '#5865f2';

  // Image-only embed: no title or description, just show the image
  if (embed.type === 'image' && !embed.title && !embed.description) {
    return (
      <div className="mt-1 max-w-[400px]">
        <a href={embed.url} target="_blank" rel="noopener noreferrer">
          <img
            src={embed.imageUrl ?? embed.url}
            alt="Embedded image"
            className="max-h-[300px] max-w-full rounded object-contain cursor-pointer"
            loading="lazy"
          />
        </a>
      </div>
    );
  }

  return (
    <div
      className="mt-1 rounded border-l-4 bg-th-bg-secondary px-3 py-2 max-w-[400px]"
      style={{ borderLeftColor: borderColor }}
    >
      {embed.siteName && (
        <p className="text-xs text-th-text-muted mb-0.5">{embed.siteName}</p>
      )}

      {embed.title && (
        <a
          href={embed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm font-semibold text-th-text-link hover:underline mb-0.5"
        >
          {embed.title}
        </a>
      )}

      {embed.description && (
        <p className="text-sm text-th-text-secondary line-clamp-3 mb-1">
          {embed.description}
        </p>
      )}

      {embed.imageUrl && (
        <a href={embed.url} target="_blank" rel="noopener noreferrer" className="block mt-1">
          <img
            src={embed.imageUrl}
            alt={embed.title ?? 'Embed image'}
            className="max-h-[300px] max-w-full rounded object-contain"
            loading="lazy"
          />
        </a>
      )}
    </div>
  );
}
