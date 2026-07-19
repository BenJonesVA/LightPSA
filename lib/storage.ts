import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

// Local-disk storage — your call over S3/R2 for this deployment. Files are
// keyed purely by the Attachment row's own cuid id, never by the
// client-supplied filename, so there's no path-traversal surface to guard
// against: the id always comes from Prisma, never from user input, and the
// original filename is only ever used for display and the download
// Content-Disposition header. In `docker-compose.yml` this directory is a
// named volume so uploads survive container recreation, the same way
// Postgres's data does.
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENT_MB = 20;

export async function saveAttachmentFile(id: string, data: Buffer): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, id), data);
}

export async function readAttachmentFile(id: string): Promise<Buffer> {
  return readFile(path.join(UPLOAD_DIR, id));
}

// Best-effort — if the file's already gone (or was never written), that's
// not an error worth surfacing to the caller deleting the Attachment row.
export async function deleteAttachmentFile(id: string): Promise<void> {
  try {
    await unlink(path.join(UPLOAD_DIR, id));
  } catch {
    // nothing to clean up
  }
}

// Org logo — a single fixed-name file (there's only ever one), served
// unauthenticated by app/api/branding/logo/route.ts. Setting.logoMimeType
// (lib/settings.ts) records whether one exists and what content type to
// send back; the file itself is content-addressed by nothing but that flag.
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_LOGO_MB = 2;
const LOGO_FILE_NAME = "branding-logo";

export async function saveLogoFile(data: Buffer): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, LOGO_FILE_NAME), data);
}

export async function readLogoFile(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(UPLOAD_DIR, LOGO_FILE_NAME));
  } catch {
    return null;
  }
}

// RFC 6266 filename*= handles non-ASCII names; the plain filename= fallback
// (with quotes/CR/LF stripped) covers older clients that ignore filename*=.
export function contentDispositionHeader(fileName: string): string {
  const safe = fileName.replace(/[\r\n"]/g, "");
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
