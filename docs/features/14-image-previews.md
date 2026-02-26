# 14 — Image & Media Previews

## Summary

Display inline previews for image and video attachments in messages. Images show as thumbnails that expand on click. Videos show an inline player. This is primarily a frontend feature.

## Backend Changes (Minor)

### Modify `server/src/modules/messages/messages.service.ts`

When storing attachments, detect image dimensions using Sharp (already a dependency):

```typescript
import sharp from 'sharp';

// For image attachments, extract dimensions
if (contentType.startsWith('image/')) {
  const metadata = await sharp(buffer).metadata();
  // Store width and height on the attachment record
}
```

### Modify `server/src/db/schema/messages.ts` (attachments)

Add dimension fields to the `attachments` table if not already present:

```typescript
width: integer('width'),
height: integer('height'),
```

### Modify shared attachment type

Add to `Attachment` type:

```typescript
width: number | null;
height: number | null;
```

## Frontend Changes

### Create `client/src/components/chat/AttachmentPreview.tsx`

Replace the current attachment display with a richer component:

**Image attachments** (`image/png`, `image/jpeg`, `image/gif`, `image/webp`):
- Show inline thumbnail with constrained max dimensions (max 400px wide, max 300px tall)
- Maintain aspect ratio using width/height from metadata
- Lazy load with `loading="lazy"` attribute
- Click to open full-size image in a lightbox modal
- Show loading skeleton while image loads
- GIFs: auto-play, but show a "GIF" badge

**Video attachments** (`video/mp4`, `video/webm`):
- Show inline `<video>` player with native controls
- Max width 400px
- Poster frame (first frame) as thumbnail until play
- `preload="metadata"` to show duration without full download

**Audio attachments** (`audio/mp3`, `audio/ogg`, `audio/wav`):
- Show inline `<audio>` player with native controls
- Show filename and file size

**Other files**:
- Show file icon, filename, size, and download button (current behavior)

### Create `client/src/components/chat/ImageLightbox.tsx`

A fullscreen modal for viewing images at full resolution:
- Dark overlay background
- Image centered and scaled to fit viewport
- Click outside or press Escape to close
- Download button
- Navigation arrows if multiple images in the message (left/right or arrow keys)
- Zoom on click or scroll (optional, can defer)

### Modify `client/src/components/chat/MessageItem.tsx`

Replace the current attachment rendering section with the new `AttachmentPreview` component.

If the message contains ONLY image attachments and no text content, render the images larger (up to 550px wide) — similar to how Discord handles image-only messages.

### Image grid layout

When a message has multiple images (2-4):
- 2 images: side-by-side, each 50% width
- 3 images: 2 on top, 1 on bottom spanning full width
- 4 images: 2x2 grid

```
┌─────┬─────┐     ┌─────┬─────┐     ┌─────┬─────┐
│  1  │  2  │     │  1  │  2  │     │  1  │  2  │
│     │     │     │     │     │     │     │     │
└─────┴─────┘     ├─────┴─────┤     ├─────┼─────┤
   2 images       │     3     │     │  3  │  4  │
                  └───────────┘     └─────┴─────┘
                    3 images          4 images
```

5+ images: first 4 in grid, rest as smaller thumbnails below.

### Styling

Thumbnail container:
```
rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity
```

Image grid:
```
grid gap-1 max-w-[400px]
```

Lightbox:
```
fixed inset-0 z-50 bg-black/80 flex items-center justify-center
```

## Edge Cases

- Broken image URL: show a "broken image" placeholder with the filename
- Very large images: the backend already resizes, but the frontend should use `object-fit: contain` to prevent layout shifts
- NSFW content: no automatic detection (could add later as a separate feature)
- SVG files: render as images but be aware of potential XSS — serve with `Content-Type: image/svg+xml` and proper CSP headers
- Progressive loading: use blur-up placeholder technique if the backend generates thumbnails
- Mobile: single-column layout for image grids, full-width images
