// A small Express-style router: same matching rules as the Express app (":param"
// segments, case-insensitive, optional trailing slash, first match wins), so the
// route table can be ported in the same order.
import type { Ctx, Result } from "./ctx";

export type Handler = (ctx: Ctx) => Result | Promise<Result>;
type Method = "GET" | "POST";

interface Route { method: Method; re: RegExp; keys: string[]; handler: Handler }

function compile(pattern: string): { re: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = pattern
    .replace(/\/+$/, "")
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) { keys.push(seg.slice(1)); return "([^/]+?)"; }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { re: new RegExp("^" + (src || "") + "/?$", "i"), keys };
}

export class Router {
  private routes: Route[] = [];

  get(pattern: string, handler: Handler): this { return this.add("GET", pattern, handler); }
  post(pattern: string, handler: Handler): this { return this.add("POST", pattern, handler); }

  private add(method: Method, pattern: string, handler: Handler): this {
    const { re, keys } = compile(pattern);
    this.routes.push({ method, re, keys, handler });
    return this;
  }

  /** The first route matching method + path, with its decoded params. HEAD matches GET. */
  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    const m = method === "HEAD" ? "GET" : method;
    for (const r of this.routes) {
      if (r.method !== m) continue;
      const hit = r.re.exec(path);
      if (!hit) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => {
        try { params[k] = decodeURIComponent(hit[i + 1]); } catch { params[k] = hit[i + 1]; }
      });
      return { handler: r.handler, params };
    }
    return null;
  }
}
