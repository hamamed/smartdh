import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in web/ inside the Express repo; keep Turbopack's root here.
  turbopack: { root: __dirname },
  // Pages are plain server-rendered HTML like the Express version; the browser
  // script (public/js/app.js) drives the UI, so no client-side routing is used.
  poweredByHeader: false,
  // The production build skips tests (they need the Express app next to them).
  typescript: { tsconfigPath: "tsconfig.build.json" },
  // Native/CommonJS server libraries stay as runtime requires.
  serverExternalPackages: ["bcryptjs", "nodemailer", "qrcode"],
};

export default nextConfig;
