# Task 12: File Upload Module

## Objective
Implement file upload for user avatars and message attachments using local filesystem storage with an abstracted storage interface. Set up @fastify/multipart and static file serving.

## Dependencies
- Task 7 (user routes exist for avatar upload endpoint)
- Task 10 is ideal but not strictly required (message attachments can be designed independently)

## Pre-existing Files to Read
- `server/src/app.ts` - App factory
- `server/src/config.ts` - UPLOAD_DIR, MAX_UPLOAD_SIZE config
- `server/src/db/schema/users.ts` - users table (avatarUrl field)
- `server/src/db/schema/messages.ts` - attachments table
- `server/src/modules/users/users.routes.ts` - Add avatar endpoint here
- `server/src/modules/messages/messages.routes.ts` - Modify message creation for attachments (or document how to integrate)
- `server/src/utils/snowflake.ts` - ID generator for attachment IDs
- `server/src/utils/errors.ts` - Error classes

## Files to Create

### 1. `server/src/plugins/uploads.ts` - Multipart Upload Plugin
Register @fastify/multipart with config:
- File size limit: MAX_UPLOAD_SIZE from config
- Attach uploaded field count limits

Also register @fastify/static for serving uploaded files:
- Root: config.UPLOAD_DIR
- Prefix: /uploads/
- Decorators: false (don't conflict with other static plugins)

### 2. `server/src/storage/local.ts` - Local Storage Provider
Abstract storage interface + local filesystem implementation:

```typescript
export interface StorageProvider {
  save(path: string, data: Buffer, contentType?: string): Promise<string>; // returns URL
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export class LocalStorageProvider implements StorageProvider {
  constructor(private baseDir: string, private baseUrl: string) {}

  async save(relativePath: string, data: Buffer): Promise<string> {
    // Ensure directory exists (mkdir -p)
    // Write file
    // Return URL: /uploads/{relativePath}
  }

  async delete(relativePath: string): Promise<void> {
    // Delete file, ignore if not found
  }

  async exists(relativePath: string): Promise<boolean> {
    // Check if file exists
  }
}
```

### 3. Add to `server/src/modules/users/users.routes.ts`
New endpoint:
- `PUT /api/users/@me/avatar` - Upload avatar
  - Accept multipart/form-data with single file field "avatar"
  - Validate: image/* content type only, max 8MB
  - Resize to max 256x256 using `sharp` (add to dependencies)
  - Convert to WebP format
  - Save to `avatars/{userId}.webp`
  - Update user avatarUrl in DB
  - Delete old avatar file if it existed
  - Return updated user

### 4. Create attachment handling utilities
- `server/src/modules/messages/attachments.ts`
  - Function to handle file attachments on message creation
  - Accept array of files from multipart
  - Validate: max 10MB per file, max 5 files
  - Allowed types: images, video, audio, PDF, text, common document formats
  - Reject executables (.exe, .sh, .bat, etc.)
  - Save to `attachments/{channelId}/{messageId}/{filename}`
  - Generate unique filename if collision (append snowflake suffix)
  - Create attachment records in DB
  - Return attachment objects

### 5. Update server/package.json
Add `sharp` dependency and `@fastify/static`.

### 6. Update `server/src/app.ts`
Register uploads plugin.

## File Type Validation
Allowed MIME types:
- image/*: jpeg, png, gif, webp, svg+xml
- video/*: mp4, webm
- audio/*: mpeg, ogg, wav
- application/pdf
- text/plain

Blocked extensions (regardless of MIME): .exe, .sh, .bat, .cmd, .com, .msi, .dll, .scr

## Acceptance Criteria
- [ ] PUT /api/users/@me/avatar uploads and processes avatar
- [ ] Avatar resized to 256x256, converted to WebP
- [ ] Old avatar deleted on re-upload
- [ ] Attachments can be uploaded with messages (or infrastructure is ready)
- [ ] GET /uploads/* serves files from the upload directory
- [ ] File type validation rejects dangerous files
- [ ] Size limits enforced (8MB avatar, 10MB attachments)
- [ ] StorageProvider interface is clean and swappable
- [ ] Directories created automatically as needed
- [ ] TypeScript compilation passes
