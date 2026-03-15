import { useState } from 'react';
import type { Attachment } from '@harmonium/shared';
import { ImageLightbox } from './ImageLightbox.js';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav']);

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function isImageAttachment(att: Attachment): boolean {
  if (att.contentType?.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(getFileExtension(att.filename));
}

function isVideoAttachment(att: Attachment): boolean {
  if (att.contentType?.startsWith('video/')) return true;
  return VIDEO_EXTENSIONS.has(getFileExtension(att.filename));
}

function isAudioAttachment(att: Attachment): boolean {
  if (att.contentType?.startsWith('audio/')) return true;
  return AUDIO_EXTENSIONS.has(getFileExtension(att.filename));
}

function ImageThumbnail({
  attachment,
  onClick,
  className,
}: {
  attachment: Attachment;
  onClick: () => void;
  className?: string;
}) {
  // Calculate constrained dimensions preserving aspect ratio
  const maxWidth = 400;
  const maxHeight = 300;
  let style: React.CSSProperties | undefined;

  if (attachment.width && attachment.height) {
    const ratio = Math.min(maxWidth / attachment.width, maxHeight / attachment.height, 1);
    style = {
      width: Math.round(attachment.width * ratio),
      height: Math.round(attachment.height * ratio),
    };
  }

  return (
    <img
      src={attachment.url}
      alt={attachment.filename}
      style={style}
      className={`max-h-[300px] max-w-[400px] rounded object-contain cursor-pointer hover:opacity-95 transition-opacity ${className ?? ''}`}
      loading="lazy"
      onClick={onClick}
    />
  );
}

function VideoPreview({ attachment }: { attachment: Attachment }) {
  return (
    <div className="mt-1 max-w-[400px]">
      <video
        src={attachment.url}
        controls
        preload="metadata"
        className="max-h-[300px] max-w-full rounded"
      >
        <track kind="captions" />
      </video>
      <div className="mt-0.5 text-xs text-th-text-muted">
        {attachment.filename} - {formatFileSize(attachment.sizeBytes)}
      </div>
    </div>
  );
}

function AudioPreview({ attachment }: { attachment: Attachment }) {
  return (
    <div className="mt-1 flex flex-col gap-1 rounded bg-th-bg-secondary border border-th-border px-3 py-2 max-w-[400px]">
      <div className="flex items-center gap-2">
        <svg className="h-5 w-5 flex-shrink-0 text-th-text-secondary" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v9.28a4.39 4.39 0 0 0-1.5-.28C8.01 12 6 13.79 6 16s2.01 4 4.5 4S15 18.21 15 16V6h3V3h-6z" />
        </svg>
        <span className="text-sm text-th-text-primary truncate">{attachment.filename}</span>
        <span className="text-xs text-th-text-muted flex-shrink-0">{formatFileSize(attachment.sizeBytes)}</span>
      </div>
      <audio src={attachment.url} controls preload="metadata" className="w-full h-8">
        <track kind="captions" />
      </audio>
    </div>
  );
}

function FilePreview({ attachment }: { attachment: Attachment }) {
  return (
    <div className="mt-1 flex items-center gap-3 rounded bg-th-bg-secondary border border-th-border px-3 py-2 max-w-[400px]">
      <svg className="h-8 w-8 flex-shrink-0 text-th-text-secondary" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
      </svg>
      <div className="min-w-0 flex-1">
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm text-th-text-link hover:underline"
        >
          {attachment.filename}
        </a>
        <span className="text-xs text-th-text-muted">{formatFileSize(attachment.sizeBytes)}</span>
      </div>
      <a
        href={attachment.url}
        download={attachment.filename}
        className="flex-shrink-0 p-1 text-th-text-secondary hover:text-th-text-primary transition-colors"
        title="Download"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
      </a>
    </div>
  );
}

function ImageGrid({
  images,
  onImageClick,
}: {
  images: Attachment[];
  onImageClick: (index: number) => void;
}) {
  const count = images.length;

  if (count === 1) {
    return (
      <div className="mt-1">
        <ImageThumbnail attachment={images[0]} onClick={() => onImageClick(0)} />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className="mt-1 flex gap-1 max-w-[400px]">
        {images.map((img, i) => (
          <div key={img.id} className="w-1/2">
            <img
              src={img.url}
              alt={img.filename}
              className="h-[200px] w-full rounded object-cover cursor-pointer hover:opacity-95 transition-opacity"
              loading="lazy"
              onClick={() => onImageClick(i)}
            />
          </div>
        ))}
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className="mt-1 flex flex-col gap-1 max-w-[400px]">
        <div className="flex gap-1">
          {images.slice(0, 2).map((img, i) => (
            <div key={img.id} className="w-1/2">
              <img
                src={img.url}
                alt={img.filename}
                className="h-[150px] w-full rounded object-cover cursor-pointer hover:opacity-95 transition-opacity"
                loading="lazy"
                onClick={() => onImageClick(i)}
              />
            </div>
          ))}
        </div>
        <img
          src={images[2].url}
          alt={images[2].filename}
          className="h-[150px] w-full rounded object-cover cursor-pointer hover:opacity-95 transition-opacity"
          loading="lazy"
          onClick={() => onImageClick(2)}
        />
      </div>
    );
  }

  // 4+ images: 2x2 grid
  const gridImages = images.slice(0, 4);
  const extraImages = images.slice(4);

  return (
    <div className="mt-1 flex flex-col gap-1 max-w-[400px]">
      <div className="grid grid-cols-2 gap-1">
        {gridImages.map((img, i) => (
          <div key={img.id} className="relative">
            <img
              src={img.url}
              alt={img.filename}
              className="h-[150px] w-full rounded object-cover cursor-pointer hover:opacity-95 transition-opacity"
              loading="lazy"
              onClick={() => onImageClick(i)}
            />
            {i === 3 && extraImages.length > 0 && (
              <div
                className="absolute inset-0 flex items-center justify-center rounded bg-black/50 cursor-pointer text-white text-xl font-semibold"
                onClick={() => onImageClick(3)}
              >
                +{extraImages.length}
              </div>
            )}
          </div>
        ))}
      </div>
      {extraImages.length > 0 && (
        <div className="flex gap-1 overflow-x-auto">
          {extraImages.map((img, i) => (
            <img
              key={img.id}
              src={img.url}
              alt={img.filename}
              className="h-[80px] w-[80px] rounded object-cover cursor-pointer hover:opacity-95 transition-opacity flex-shrink-0"
              loading="lazy"
              onClick={() => onImageClick(4 + i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AttachmentPreview({ attachments }: { attachments: Attachment[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const images: Attachment[] = [];
  const videos: Attachment[] = [];
  const audio: Attachment[] = [];
  const files: Attachment[] = [];

  for (const att of attachments) {
    if (isImageAttachment(att)) {
      images.push(att);
    } else if (isVideoAttachment(att)) {
      videos.push(att);
    } else if (isAudioAttachment(att)) {
      audio.push(att);
    } else {
      files.push(att);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {images.length > 0 && (
        <ImageGrid
          images={images}
          onImageClick={(index) => setLightboxIndex(index)}
        />
      )}

      {videos.map((att) => (
        <VideoPreview key={att.id} attachment={att} />
      ))}

      {audio.map((att) => (
        <AudioPreview key={att.id} attachment={att} />
      ))}

      {files.map((att) => (
        <FilePreview key={att.id} attachment={att} />
      ))}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={(index) => setLightboxIndex(index)}
        />
      )}
    </div>
  );
}
