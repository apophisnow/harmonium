import type { MultipartFile } from '@fastify/multipart';
import type { StorageProvider } from '../../storage/local.js';
import { getDb, schema } from '../../db/index.js';
import { generateId } from '../../utils/snowflake.js';
import { ValidationError } from '../../utils/errors.js';

// Allowed MIME type prefixes and specific types
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'video/',
  'audio/',
];

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
]);

// Blocked file extensions (executables and scripts)
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.sh', '.bash',
  '.com', '.scr', '.pif', '.vbs', '.vbe',
  '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh',
  '.ps1', '.ps2', '.psc1', '.psc2',
  '.msh', '.msh1', '.msh2', '.mshxml',
  '.reg', '.inf', '.hta', '.cpl',
  '.dll', '.sys', '.drv',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_FILES = 5;

function isAllowedMimeType(mimetype: string): boolean {
  if (ALLOWED_MIME_TYPES.has(mimetype)) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimetype.startsWith(prefix));
}

function hasBlockedExtension(filename: string): boolean {
  const lowerFilename = filename.toLowerCase();
  const lastDotIndex = lowerFilename.lastIndexOf('.');
  if (lastDotIndex === -1) return false;
  const ext = lowerFilename.slice(lastDotIndex);
  return BLOCKED_EXTENSIONS.has(ext);
}

export interface AttachmentResult {
  id: string;
  messageId: string;
  filename: string;
  url: string;
  contentType: string | null;
  sizeBytes: number;
  createdAt: string;
}

export async function processAttachments(
  files: AsyncIterableIterator<MultipartFile>,
  channelId: string,
  messageId: string,
  storage: StorageProvider,
): Promise<AttachmentResult[]> {
  const db = getDb();
  const results: AttachmentResult[] = [];
  let fileCount = 0;

  for await (const file of files) {
    fileCount++;

    if (fileCount > MAX_FILES) {
      throw new ValidationError(`Maximum ${MAX_FILES} files allowed per message`);
    }

    // Validate filename for blocked extensions
    if (hasBlockedExtension(file.filename)) {
      throw new ValidationError(`File type not allowed: ${file.filename}`);
    }

    // Validate MIME type
    if (!isAllowedMimeType(file.mimetype)) {
      throw new ValidationError(`File type not allowed: ${file.mimetype}`);
    }

    // Read file data
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    // Check if the file was truncated (exceeded size limit)
    if (file.file.truncated) {
      throw new ValidationError(`File too large: ${file.filename}. Maximum size is 10MB`);
    }

    // Validate size
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new ValidationError(`File too large: ${file.filename}. Maximum size is 10MB`);
    }

    // Sanitize filename - keep only safe characters
    const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Save file
    const relativePath = `attachments/${channelId}/${messageId}/${safeFilename}`;
    const url = await storage.save(relativePath, fileBuffer, file.mimetype);

    // Create DB record
    const attachmentId = generateId();
    const now = new Date();

    await db.insert(schema.attachments).values({
      id: attachmentId,
      messageId: BigInt(messageId),
      filename: file.filename,
      url,
      contentType: file.mimetype || null,
      sizeBytes: fileBuffer.length,
      createdAt: now,
    });

    results.push({
      id: attachmentId.toString(),
      messageId,
      filename: file.filename,
      url,
      contentType: file.mimetype || null,
      sizeBytes: fileBuffer.length,
      createdAt: now.toISOString(),
    });
  }

  return results;
}
