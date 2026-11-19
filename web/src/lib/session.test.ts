import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { createSession, readSession, signSid, unsignSid, writeSession } from "./session";

// The exact library express-session signs cookies with (installed for the Express app).
const require = createRequire(import.meta.url);
const cookieSignature = require("../../../node_modules/cookie-signature") as { sign(v: string, s: string): string };

describe("session cookie", () => {
  it("signs exactly like express-session", () => {
    const sid = "AbCdEfGhIjKlMnOpQrStUvWxYz012345";
    expect(signSid(sid)).toBe("s:" + cookieSignature.sign(sid, "test-secret"));
  });

  it("accepts a cookie signed by express-session and rejects tampering", () => {
    const sid = "Zz9_-aaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const value = "s:" + cookieSignature.sign(sid, "test-secret");
    expect(unsignSid(value)).toBe(sid);
    expect(unsignSid(value.replace("Zz9", "Zz8"))).toBeNull();
    expect(unsignSid("s:" + cookieSignature.sign(sid, "other-secret"))).toBeNull();
    expect(unsignSid("garbage")).toBeNull();
  });
});

describe("session files", () => {
  it("reads a session file written by session-file-store", () => {
    const sid = "fileStoreWrittenSession_1234567";
    const dir = path.join(process.env.DATA_DIR as string, "sessions");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, sid + ".json"), JSON.stringify({
      cookie: { originalMaxAge: 604800000, expires: new Date(Date.now() + 1e8).toISOString(), secure: true, httpOnly: true, domain: ".kanzup.com", path: "/", sameSite: "lax" },
      csrf: "abc", userId: 7, lang: "fr", __lastAccess: Date.now() - 1000,
    }));
    expect(readSession(sid)).toMatchObject({ userId: 7, lang: "fr", csrf: "abc" });
  });

  it("treats a session untouched for over 7 days as gone", () => {
    const { sid, data } = createSession();
    const file = path.join(process.env.DATA_DIR as string, "sessions", sid + ".json");
    fs.writeFileSync(file, JSON.stringify({ ...data, __lastAccess: Date.now() - 8 * 86400000 }));
    expect(readSession(sid)).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
  });

  it("round-trips data and keeps unknown keys", () => {
    const { sid, data } = createSession();
    writeSession(sid, { ...data, userId: 3, somethingElse: { a: 1 } });
    expect(readSession(sid)).toMatchObject({ userId: 3, somethingElse: { a: 1 }, csrf: data.csrf });
  });
});
