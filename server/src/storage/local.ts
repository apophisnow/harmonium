import { mkdir, writeFile, unlink, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export interface StorageProvider {
  save(path: string, data: Buffer, contentType?: string): Promise<string>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async save(relativePath: string, data: Buffer, _contentType?: string): Promise<string> {
    const fullPath = join(this.baseDir, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
    return `/uploads/${relativePath}`;
  }

  async delete(relativePath: string): Promise<void> {
    const fullPath = join(this.baseDir, relativePath);
    try {
      await unlink(fullPath);
    } catch (err: unknown) {
      // Ignore ENOENT - file already doesn't exist
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw err;
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const fullPath = join(this.baseDir, relativePath);
    try {
      await access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
