// Request body parsing for form posts: urlencoded, JSON and multipart (uploads).
// Mirrors express.urlencoded({ extended: true }) closely enough for these forms:
// repeated keys and "name[]" keys become arrays.
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";

export interface UploadedFile {
  fieldName: string;
  originalName: string;
  mimeType: string;
  size: number;
  data: Buffer;
}

export type BodyValue = string | string[];
export interface ParsedBody {
  fields: Record<string, BodyValue>;
  files: Record<string, UploadedFile[]>;
}

const MAX_FORM_BYTES = 2 * 1024 * 1024;        // urlencoded/JSON forms
const MAX_MULTIPART_BYTES = 16 * 1024 * 1024;  // the largest upload form (2 CIN photos)

function addField(fields: Record<string, BodyValue>, rawKey: string, value: string): void {
  const isList = rawKey.endsWith("[]");
  const key = isList ? rawKey.slice(0, -2) : rawKey;
  const prev = fields[key];
  if (prev === undefined) fields[key] = isList ? [value] : value;
  else fields[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
}

async function readRaw(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw Object.assign(new Error("Request body too large"), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function parseBody(req: IncomingMessage): Promise<ParsedBody> {
  const type = (req.headers["content-type"] || "").toLowerCase();
  const fields: Record<string, BodyValue> = {};
  const files: Record<string, UploadedFile[]> = {};

  if (type.startsWith("multipart/form-data")) {
    const length = Number(req.headers["content-length"] || 0);
    if (length > MAX_MULTIPART_BYTES) throw Object.assign(new Error("Upload too large"), { status: 413 });
    const request = new Request("http://local/", {
      method: "POST",
      headers: { "content-type": req.headers["content-type"] as string },
      body: Readable.toWeb(req) as ReadableStream,
      duplex: "half",
    } as RequestInit);
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") { addField(fields, key, value); continue; }
      if (!value.name && value.size === 0) continue; // an empty file input
      const file: UploadedFile = {
        fieldName: key, originalName: value.name, mimeType: value.type || "application/octet-stream",
        size: value.size, data: Buffer.from(await value.arrayBuffer()),
      };
      (files[key] ||= []).push(file);
    }
    return { fields, files };
  }

  const raw = await readRaw(req, MAX_FORM_BYTES);
  if (!raw.length) return { fields, files };
  if (type.startsWith("application/json")) {
    try {
      const data = JSON.parse(raw.toString("utf8")) as Record<string, unknown>;
      for (const [k, v] of Object.entries(data || {})) {
        if (Array.isArray(v)) fields[k] = v.map(String);
        else if (v !== null && v !== undefined) fields[k] = String(v);
      }
    } catch { /* invalid JSON → empty body, as express.json would 400; handlers validate */ }
    return { fields, files };
  }
  for (const [k, v] of new URLSearchParams(raw.toString("utf8"))) addField(fields, k, v);
  return { fields, files };
}
