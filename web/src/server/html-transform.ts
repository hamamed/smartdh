// Final touches on the rendered page HTML, done as string replacements like the
// Express app did:
//  - React won't render string event handlers, so views write data-raw-on<event>="…"
//    and it becomes on<event>="…" here (same attribute, same escaped value).
//  - On the admin subdomain, admin links lose their "/admin" prefix (clean URLs),
//    exactly the replacement Express ran over every rendered admin-host page.
export function transformHtml(html: string, opts: { adminHost: boolean }): string {
  let out = html.replace(/ data-raw-on([a-z]+)="/g, " on$1=\"");
  if (opts.adminHost) {
    out = out.replace(/\/admin\//g, "/").replace(/"\/admin"/g, '"/"').replace(/'\/admin'/g, "'/'");
  }
  return out;
}
