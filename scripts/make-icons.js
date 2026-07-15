// Generates the PWA icons as real PNGs using only Node's zlib — no native deps.
// Run: node scripts/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');

// --- tiny PNG encoder (truecolor, 8-bit) ---
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      raw[o++] = rgb[i]; raw[o++] = rgb[i + 1]; raw[o++] = rgb[i + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// --- artwork: sunset gradient + white "growth" chart arrow ---
const lerp = (a, b, t) => a + (b - a) * t;
function gradient(t) { // mango -> coral -> pink, matching the app's --sunset
  const stops = [[255, 176, 58], [255, 106, 106], [255, 95, 143]];
  const seg = t < 0.5 ? 0 : 1;
  const lt = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = stops[seg], b = stops[seg + 1];
  return [lerp(a[0], b[0], lt), lerp(a[1], b[1], lt), lerp(a[2], b[2], lt)];
}
// distance from point p to segment ab — used to stroke the polyline
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function draw(size) {
  const rgb = Buffer.alloc(size * size * 3);
  const S = size;
  // Full-bleed gradient background (safe for "maskable")
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const [r, g, b] = gradient((x / S) * 0.45 + (y / S) * 0.55);
      const i = (y * S + x) * 3;
      rgb[i] = r; rgb[i + 1] = g; rgb[i + 2] = b;
    }
  }
  // White upward trend line (kept inside the maskable safe zone: middle ~60%)
  const pts = [[0.28, 0.66], [0.44, 0.52], [0.56, 0.60], [0.74, 0.36]].map(([x, y]) => [x * S, y * S]);
  const stroke = S * 0.055;
  const head = [[0.74, 0.36], [0.62, 0.36], [0.74, 0.36], [0.74, 0.48]].map(([x, y]) => [x * S, y * S]);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let d = Infinity;
      for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, distToSeg(x, y, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]));
      // arrow head: two strokes from the tip
      d = Math.min(d, distToSeg(x, y, head[0][0], head[0][1], head[1][0], head[1][1]));
      d = Math.min(d, distToSeg(x, y, head[2][0], head[2][1], head[3][0], head[3][1]));
      if (d <= stroke / 2) {
        const a = Math.max(0, Math.min(1, (stroke / 2 - d) * 2)); // cheap antialias
        const i = (y * S + x) * 3;
        rgb[i] = lerp(rgb[i], 255, a);
        rgb[i + 1] = lerp(rgb[i + 1], 255, a);
        rgb[i + 2] = lerp(rgb[i + 2], 255, a);
      }
    }
  }
  return encodePNG(S, S, rgb);
}

fs.mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const file = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, draw(size));
  console.log('wrote', file, fs.statSync(file).size, 'bytes');
}
