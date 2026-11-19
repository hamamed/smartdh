// Per-request context and the result a route handler returns — the Next.js stand-in
// for Express's req/res/res.locals.
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Lang, Translator } from "@/lib/locales";
import type { SessionData } from "@/lib/session";
import type { Db, User } from "@/lib/types";
import type { BodyValue, UploadedFile } from "./body";

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  method: string;
  /** Path as routed (on the admin host "/" is routed as "/admin", like Express). */
  path: string;
  /** Path the browser asked for (Express req.originalUrl without the query). */
  originalPath: string;
  query: Record<string, string>;
  body: Record<string, BodyValue>;
  files: Record<string, UploadedFile[]>;
  params: Record<string, string>;
  sid: string;
  session: SessionData;
  db: Db;
  /** The user pages act as (the impersonated player while an admin views as one). */
  user: User | null;
  /** The real admin behind an impersonation, else null. */
  realAdmin: User | null;
  impersonating: boolean;
  lang: Lang;
  t: Translator;
  adminHost: boolean;
  ip: string;
  /** Set by logout: the pipeline deletes the session file and clears the cookie. */
  destroySession: boolean;
  /** Extra layout values a route sets for the next render (like res.locals.gaEvent). */
  locals: { gaEvent?: { name: string; params: Record<string, unknown> } | null };
}

/** Body field as a single string ("" when missing), like req.body.x || ''. */
export function field(ctx: Ctx, name: string): string {
  const v = ctx.body[name];
  return Array.isArray(v) ? (v[v.length - 1] ?? "") : (v ?? "");
}

/** Body field as a list (checkbox groups, "ids[]"). */
export function fieldList(ctx: Ctx, name: string): string[] {
  const v = ctx.body[name];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

export function firstFile(ctx: Ctx, name: string): UploadedFile | null {
  return (ctx.files[name] && ctx.files[name][0]) || null;
}

export type ViewProps = Record<string, unknown>;

export type Result =
  | { kind: "render"; view: string; props: ViewProps; status?: number; title?: string; bare?: boolean }
  | { kind: "redirect"; to: string; status?: number }
  | { kind: "json"; data: unknown; status?: number }
  | { kind: "raw"; body: string | Buffer; contentType: string; status?: number; headers?: Record<string, string> }
  | { kind: "next" };

export const render = (view: string, props: ViewProps = {}, opts: { status?: number; title?: string; bare?: boolean } = {}): Result =>
  ({ kind: "render", view, props, ...opts });
export const redirect = (to: string, status = 302): Result => ({ kind: "redirect", to, status });
export const json = (data: unknown, status = 200): Result => ({ kind: "json", data, status });
export const raw = (body: string | Buffer, contentType: string, opts: { status?: number; headers?: Record<string, string> } = {}): Result =>
  ({ kind: "raw", body, contentType, ...opts });
/** Not handled here: keep looking (Express next()). */
export const pass = (): Result => ({ kind: "next" });

/** Redirect back to the page the request came from (Express req.get('referer')). */
export function referer(ctx: Ctx): string {
  const r = ctx.req.headers.referer;
  return typeof r === "string" ? r : "";
}
