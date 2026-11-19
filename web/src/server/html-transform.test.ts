import { describe, expect, it } from "vitest";
import { transformHtml } from "./html-transform";

describe("transformHtml", () => {
  it("turns data-raw-on* attributes into inline handlers", () => {
    expect(transformHtml(`<form data-raw-onsubmit="return confirm(&#x27;Sure?&#x27;)">`, { adminHost: false }))
      .toBe(`<form onsubmit="return confirm(&#x27;Sure?&#x27;)">`);
  });
  it("strips /admin from links only on the admin host", () => {
    const html = `<a href="/admin/users">u</a><a href="/admin">hub</a><script>fetch('/admin/online.json');x('/admin')</script>`;
    expect(transformHtml(html, { adminHost: false })).toBe(html);
    expect(transformHtml(html, { adminHost: true })).toBe(`<a href="/users">u</a><a href="/">hub</a><script>fetch('/online.json');x('/')</script>`);
  });
});
