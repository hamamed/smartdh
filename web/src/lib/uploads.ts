// Upload storage with the Express app's multer rules: same folder, same file-name
// patterns, same allowed types and size limits. Like multer's fileFilter, a file of a
// disallowed type is skipped (not an error); a file over the limit is an error.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "./config";

export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
export const ATTACH_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "application/pdf": ".pdf", "text/plain": ".txt",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

export interface UploadRule {
  /** File name before the random part, e.g. "u12-", "app-", "cin-". */
  prefix: string;
  randomBytes: number;
  types: Record<string, string>;
  maxBytes: number;
  /** Extension when the type has none in `types` (never used for allowed types). */
  fallbackExt: string;
}

export const RULES = {
  avatar: (userId: number): UploadRule => ({ prefix: `u${userId}-`, randomBytes: 8, types: IMAGE_TYPES, maxBytes: 3 * 1024 * 1024, fallbackExt: ".jpg" }),
  appImage: { prefix: "app-", randomBytes: 8, types: IMAGE_TYPES, maxBytes: 3 * 1024 * 1024, fallbackExt: ".jpg" } as UploadRule,
  logo: { prefix: "logo-", randomBytes: 8, types: IMAGE_TYPES, maxBytes: 3 * 1024 * 1024, fallbackExt: ".png" } as UploadRule,
  receipt: { prefix: "rcpt-", randomBytes: 8, types: IMAGE_TYPES, maxBytes: 3 * 1024 * 1024, fallbackExt: ".jpg" } as UploadRule,
  ticket: { prefix: "tk-", randomBytes: 10, types: ATTACH_TYPES, maxBytes: 6 * 1024 * 1024, fallbackExt: ".bin" } as UploadRule,
  cin: { prefix: "cin-", randomBytes: 10, types: IMAGE_TYPES, maxBytes: 5 * 1024 * 1024, fallbackExt: ".jpg" } as UploadRule,
};

export interface IncomingFile { originalName: string; mimeType: string; size: number; data: Buffer }
export type SaveResult =
  | { kind: "saved"; url: string; fileName: string; originalName: string; mimeType: string }
  | { kind: "skipped" }          // wrong type: multer's fileFilter drops it silently
  | { kind: "too-big" };         // multer's LIMIT_FILE_SIZE

export function saveUpload(file: IncomingFile | null | undefined, rule: UploadRule): SaveResult {
  if (!file) return { kind: "skipped" };
  if (!rule.types[file.mimeType]) return { kind: "skipped" };
  if (file.size > rule.maxBytes) return { kind: "too-big" };
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const fileName = rule.prefix + crypto.randomBytes(rule.randomBytes).toString("hex") + (rule.types[file.mimeType] || rule.fallbackExt);
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), file.data);
  return { kind: "saved", url: "/uploads/" + fileName, fileName, originalName: file.originalName, mimeType: file.mimeType };
}

/** Remove a previously uploaded file — never anything outside /uploads. */
export function deleteUpload(url: string | null | undefined): void {
  if (!url || !url.startsWith("/uploads/")) return;
  fs.unlink(path.join(UPLOAD_DIR, path.basename(url)), () => {});
}
