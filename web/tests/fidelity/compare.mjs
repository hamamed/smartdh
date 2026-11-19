// Page-by-page comparison of the Express app (repo root) and the Next app (web/).
// Both run on identical copies of the made-up fixture; every page in the list is
// fetched from both (signed in as needed), normalised, and diffed.
//
//   cd web && npm run build && node tests/fidelity/compare.mjs [filter]
//
// Prints "same" or a unified diff per page; exits 1 if any page differs.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "parse5";
import vm from "node:vm";
import { ADMIN_EMAIL, PASSWORD, buildFixture } from "./fixture.mjs";
import { PAGES } from "./pages.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "../..");
const ROOT = path.resolve(WEB, "..");
const EXPRESS_PORT = 4599, NEXT_PORT = 4600;
const ENV = { SESSION_SECRET: "fidelity", ADMIN_EMAIL, APP_URL: "http://kanzup.test", ADMIN_URL: "", COOKIE_DOMAIN: "", SMTP_HOST: "" };

// ---------- servers ----------
function prepareExpress(fixture) {
  // A copy of the Express app with its own data/ (db.js always uses __dirname/data).
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kz-express-"));
  for (const f of ["server.js", "db.js", "email.js", "locales.js", "package.json"]) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  execFileSync("cp", ["-R", path.join(ROOT, "views"), path.join(ROOT, "public"), dir]);
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.writeFileSync(path.join(dir, "data", "db.json"), JSON.stringify(fixture));
  return dir;
}

function start(cmd, args, cwd, env, port, log) {
  const child = spawn(cmd, args, { cwd, env: { ...process.env, ...ENV, ...env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  const out = fs.createWriteStream(log);
  child.stdout.pipe(out); child.stderr.pipe(out);
  return child;
}

async function waitUp(port) {
  for (let i = 0; i < 80; i++) {
    try { await request(port, "GET", "/terms"); return; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }
  throw new Error("server on port " + port + " did not start");
}

// ---------- http ----------
// Each logical request gets its own made-up client IP (the same one for both apps), so
// the 20-per-15-minutes auth rate limit isn't hit by the test itself.
let ipSeq = 0;
const nextIp = () => { ipSeq++; return `10.77.${Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`; };

function request(port, method, urlPath, { cookie = "", body = null, host = "localhost", ip = "10.66.0.1" } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Host: host, Cookie: cookie, "Accept-Language": "en", "X-Forwarded-For": ip };
    if (body) { headers["Content-Type"] = "application/x-www-form-urlencoded"; headers["Content-Length"] = Buffer.byteLength(body); }
    const req = http.request({ port, method, path: urlPath, headers }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const sidOf = (res, prev) => {
  const set = [].concat(res.headers["set-cookie"] || []).find((c) => c.startsWith("kz.sid="));
  return set ? set.split(";")[0] : prev;
};
const csrfOf = (html) => (html.match(/name="_csrf" value="([^"]+)"/) || [])[1] || "";

async function signIn(port, email, ip) {
  const page = await request(port, "GET", "/login", { ip });
  let cookie = sidOf(page, "");
  const body = new URLSearchParams({ _csrf: csrfOf(page.body), email, password: PASSWORD }).toString();
  const res = await request(port, "POST", "/login", { cookie, body, ip });
  cookie = sidOf(res, cookie);
  if (res.status !== 302) throw new Error(`login as ${email} on ${port} failed (${res.status})`);
  return cookie;
}

// ---------- normalising ----------
const BOOLEAN = new Set(["required", "selected", "checked", "disabled", "hidden", "autofocus", "multiple", "readonly", "novalidate", "async", "defer"]);
const VOLATILE_VALUE = new Set(["_csrf", "_t"]);

function normStyle(v) {
  return v.split(";").map((d) => d.trim()).filter(Boolean).map((d) => {
    const i = d.indexOf(":");
    return i < 0 ? d : d.slice(0, i).trim().toLowerCase() + ":" + d.slice(i + 1).trim().replace(/\s+/g, " ");
  }).join(";");
}

// window.MSG is JSON in the Next version (EJS HTML-escaped quotes inside JS strings,
// e.g. &#39;). Compare the decoded values, keys sorted.
const decode = (v) => String(v).replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function canonicalMsg(code) {
  return code.replace(/window\.MSG = (\{[\s\S]*?\})\s*;/, (_, obj) => {
    const o = vm.runInNewContext("(" + obj + ")");
    const sorted = Object.fromEntries(Object.keys(o).sort().map((k) => [k, decode(o[k])]));
    return "window.MSG = " + JSON.stringify(sorted) + ";";
  });
}

// Values that differ between two live servers by nature: the session's CSRF token
// (48 hex chars, also inside form URLs and scripts), balances that accrue every
// second (rounded to cents here), and the chart point stamped at request time.
// Things created while the comparison runs get timestamps a millisecond apart on the
// two servers; times from before the run (the fixture) are still compared exactly.
const RUN_START = Date.now();
const maskCsrf = (v) => v.replace(/\b[0-9a-f]{48}\b/g, "<csrf>");
function maskVolatile(name, v) {
  v = maskCsrf(v);
  if (name === "data-value" || name === "data-persec") v = v.replace(/^(-?\d+\.\d{2})\d*$/, "$1");
  if (name === "data-points") v = v.replace(/"t":1\d{12}/g, '"t":<ts>');
  return v;
}

function skipElement(el) {
  const a = Object.fromEntries((el.attrs || []).map((x) => [x.name, x.value]));
  if (el.nodeName === "meta" && (a.name === "next-head-count" || a.charset)) return true;
  if (el.nodeName === "noscript" && "data-n-css" in a) return true;
  if (el.nodeName === "link" && a.rel === "preload" && a.as === "image") return true; // React 19 adds image preload hints
  if (el.nodeName === "style" && el.childNodes?.[0]?.value?.includes("#__next{display:contents}")) return true;
  if ((el.nodeName === "script" && (a.src || "").startsWith("/_next/")) || (el.nodeName === "link" && (a.href || "").startsWith("/_next/"))) return true;
  return false;
}

function normalise(html) {
  const doc = parse(html);
  const lines = [];
  const walk = (node, depth) => {
    let text = "";
    const flush = () => { const s = text.replace(/\s+/g, " ").trim(); if (s) lines.push("  ".repeat(depth) + JSON.stringify(s)); text = ""; };
    for (const child of node.childNodes || []) {
      if (child.nodeName === "#text") { text += child.value; continue; }
      if (child.nodeName === "#comment") continue; // React inserts <!-- --> between text runs
      flush();
      if (child.nodeName === "#documentType") continue;
      if (skipElement(child)) continue;
      const attrs = Object.fromEntries((child.attrs || []).map((x) => [x.name, x.value]));
      if (child.nodeName === "div" && attrs.id === "__next") { walk(child, depth); continue; }
      delete attrs["data-next-head"]; // Next marks head tags it manages; not page content
      if (attrs["data-ago"] && Number(attrs["data-ago"]) >= RUN_START) {
        attrs["data-ago"] = "<during-run>";
        if ("title" in attrs) attrs.title = "<during-run>";
      }
      const parts = Object.keys(attrs).sort().map((k) => {
        let v = attrs[k];
        if (k === "style") v = normStyle(v);
        else if (k === "class") v = v.split(/\s+/).filter(Boolean).join(" ");
        else if (BOOLEAN.has(k)) v = "";
        else if (k === "value" && VOLATILE_VALUE.has(attrs.name)) v = "*";
        else v = maskVolatile(k, v);
        return v === "" ? k : `${k}=${JSON.stringify(v)}`;
      });
      lines.push("  ".repeat(depth) + "<" + child.nodeName + (parts.length ? " " + parts.join(" ") : "") + ">");
      if (child.nodeName === "head") {
        const start = lines.length;
        walk(child, depth + 1);
        const blocks = [];
        for (const line of lines.splice(start)) {
          if (line.startsWith("  ".repeat(depth + 1) + "<")) blocks.push([line]); else blocks[blocks.length - 1].push(line);
        }
        blocks.sort((x, y) => x.join("\n").localeCompare(y.join("\n")));
        for (const b of blocks) lines.push(...b);
        continue;
      }
      const content = child.nodeName === "template" ? child.content : child;
      if (child.nodeName === "script" || child.nodeName === "style") {
        const code = maskCsrf(canonicalMsg((content.childNodes || []).map((c) => c.value || "").join(""))).replace(/\s+/g, " ").trim();
        if (code) lines.push("  ".repeat(depth + 1) + "{code} " + code);
      } else walk(content, depth + 1);
    }
    flush();
  };
  walk(doc, 0);
  return lines.join("\n") + "\n";
}

// ---------- run ----------
async function main() {
  const filter = process.argv[2] || "";
  const fixture = buildFixture();
  const expressDir = prepareExpress(fixture);
  const nextData = fs.mkdtempSync(path.join(os.tmpdir(), "kz-next-"));
  fs.writeFileSync(path.join(nextData, "db.json"), JSON.stringify(fixture));
  const logs = fs.mkdtempSync(path.join(os.tmpdir(), "kz-logs-"));

  const ex = start("node", ["server.js"], expressDir, {}, EXPRESS_PORT, path.join(logs, "express.log"));
  const nx = start(path.join(WEB, "node_modules/.bin/next"), ["start", "-p", String(NEXT_PORT)], WEB, { DATA_DIR: nextData, UPLOAD_DIR: path.join(nextData, "uploads") }, NEXT_PORT, path.join(logs, "next.log"));
  let failures = 0;
  try {
    await Promise.all([waitUp(EXPRESS_PORT), waitUp(NEXT_PORT)]);
    const jars = { [EXPRESS_PORT]: {}, [NEXT_PORT]: {} };
    const loginIp = {};
    const cookieFor = async (port, as, fresh) => {
      if (as === "anon") return "";
      const email = as === "admin" ? ADMIN_EMAIL : as.includes("@") ? as : `${as}@kanzup.test`;
      const ip = (loginIp[email + (fresh ? "#fresh" : "")] ??= nextIp());
      if (fresh) return signIn(port, email, ip); // e.g. logout: don't spoil the shared session
      return (jars[port][email] ??= await signIn(port, email, ip));
    };
    const out = path.join(logs, "diffs");
    fs.mkdirSync(out);
    for (const page of PAGES) {
      const label = `${page.as.padEnd(16)} ${page.form ? "POST " : ""}${page.path}${page.note ? "  (" + page.note + ")" : ""}`;
      if (filter && !label.includes(filter)) continue;
      const ip = nextIp();
      const [a, b] = await Promise.all([EXPRESS_PORT, NEXT_PORT].map(async (port) => {
        let cookie = await cookieFor(port, page.as, page.fresh);
        const host = page.host || "localhost";
        if (!page.form) return request(port, "GET", page.path, { cookie, host, ip });
        // A form post: load the page with the form first for the session's CSRF token.
        const formPage = await request(port, "GET", page.formPage || page.path, { cookie, host, ip });
        cookie = sidOf(formPage, cookie);
        const fields = typeof page.form === "function" ? page.form() : page.form;
        const body = new URLSearchParams({ _csrf: csrfOf(formPage.body), ...fields }).toString();
        return request(port, "POST", page.path, { cookie, host, body, ip });
      }));
      // The Next page must be plain HTML: no React runtime, no serialised page data.
      if (/__NEXT_DATA__|\/_next\/static\/chunks\//.test(b.body)) {
        failures++;
        console.log("CLIENT JS " + label + " — the Next page ships Next.js scripts or page data");
        continue;
      }
      // JSON replies: drop the live clock, round accruing money to cents, sort keys.
      const isJson = (r) => String(r.headers["content-type"] || "").includes("application/json") && !String(r.headers["content-disposition"] || "");
      const canonJson = (txt) => JSON.stringify(JSON.parse(txt), (k, v) => {
        if (k === "now") return undefined;
        if (typeof v === "number" && v >= RUN_START && v < RUN_START + 36e5) return "<during-run>";
        if (typeof v === "number" && !Number.isInteger(v)) return Math.round(v * 100) / 100;
        if (v && typeof v === "object" && !Array.isArray(v)) return Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]]));
        return v;
      }, 1) + "\n";
      const isText = (r) => /text\/csv|attachment/.test(String(r.headers["content-type"] || "") + String(r.headers["content-disposition"] || ""));
      // Rows created during the run: their time and random referral code differ by nature.
      const maskIso = (txt) => txt.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, (iso) => (Date.parse(iso) >= RUN_START ? "<during-run>" : iso))
        .split("\n").map((line) => (line.includes("<during-run>") ? line.replace(/,[A-HJ-NP-Z2-9]{7},/g, ",<code>,") : line)).join("\n");
      const bodyOf = (r) => isJson(r) ? canonJson(r.body) : isText(r) ? maskIso(r.body.replace(/\r\n/g, "\n")) + "\n" : normalise(r.body);
      const head = (r) => `HTTP ${r.status}${r.headers.location ? " → " + r.headers.location : ""}\n`;
      const na = head(a) + (a.status === 200 || a.status >= 400 ? bodyOf(a) : "");
      const nb = head(b) + (b.status === 200 || b.status >= 400 ? bodyOf(b) : "");
      if (na === nb) { console.log("same     " + label); continue; }
      if (page.known) {
        console.log("KNOWN    " + label + " — " + page.known);
      } else failures++;
      const slug = (page.form ? "POST" : "") + (page.note || "") + page.path.replace(/[^a-z0-9]+/gi, "_") + "_" + page.as.replace(/[^a-z0-9]+/gi, "_");
      const fa = path.join(out, slug + ".express.txt"), fb = path.join(out, slug + ".next.txt");
      fs.writeFileSync(fa, na); fs.writeFileSync(fb, nb);
      let diff = "";
      try { execFileSync("diff", ["-u", fa, fb]); } catch (e) { diff = String(e.stdout); }
      if (!page.known) console.log("DIFFERS  " + label + "\n" + diff.split("\n").slice(2, 60).join("\n"));
    }
  } finally {
    ex.kill(); nx.kill();
    console.log(`\nlogs and full diffs: ${logs}`);
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
