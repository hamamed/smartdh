import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages are plain server-rendered HTML like the Express version; the browser
  // script (public/js/app.js) drives the UI, so no client-side routing is used.
  poweredByHeader: false,
  // Native/CommonJS server libraries stay as runtime requires.
  serverExternalPackages: ["bcryptjs", "nodemailer", "qrcode"],
};

export default nextConfig;
