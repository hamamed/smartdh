// Generates the email header banner as a real PNG (brand gradient + soft top
// highlight + scattered dots), so the pattern shows in Gmail/Apple Mail — email
// clients strip data-URI backgrounds, so it must be a hosted image.
//   node scripts/make-email-pattern.js   ->  public/email/pattern.png
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// --- tiny PNG encoder (truecolor, 8-bit) — same approach as make-icons.js ---
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

// --- artwork: 135° emerald gradient + top highlight + white dots ---
const W = 1120, H = 300;                 // 2x of the 560px email width, for crisp scaling
const c1 = [19, 176, 127];               // #13b07f (light corner)
const c2 = [11, 125, 87];                // #0b7d57 (dark corner)
// dot centres in 0..1 space with radii in px (fixed, so the output is stable)
const dots = [
  [0.06, 0.30, 11], [0.19, 0.72, 8], [0.31, 0.20, 9], [0.44, 0.82, 7],
  [0.55, 0.42, 10], [0.67, 0.14, 8], [0.78, 0.62, 9], [0.89, 0.34, 7],
  [0.13, 0.90, 6], [0.62, 0.92, 6], [0.37, 0.56, 6], [0.85, 0.86, 7],
  [0.25, 0.46, 6], [0.50, 0.22, 6], [0.95, 0.60, 6], [0.03, 0.62, 6]
];

const rgb = Buffer.alloc(W * H * 3);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = ((x / W) + (y / H)) / 2;                 // diagonal (135°) gradient
    let r = c1[0] + (c2[0] - c1[0]) * t;
    let g = c1[1] + (c2[1] - c1[1]) * t;
    let b = c1[2] + (c2[2] - c1[2]) * t;
    // soft highlight near the top-centre
    const dx = (x - W * 0.5) / W, dy = y / H;
    const hl = Math.max(0, 0.22 * (1 - Math.sqrt(dx * dx * 1.3 + dy * dy) * 1.5));
    r += (255 - r) * hl; g += (255 - g) * hl; b += (255 - b) * hl;
    // dots (soft white)
    for (let k = 0; k < dots.length; k++) {
      const px = dots[k][0] * W, py = dots[k][1] * H, rad = dots[k][2];
      const d = Math.hypot(x - px, y - py);
      if (d < rad) { const a = 0.20 * (1 - d / rad); r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
    }
    const i = (y * W + x) * 3;
    rgb[i] = Math.round(r); rgb[i + 1] = Math.round(g); rgb[i + 2] = Math.round(b);
  }
}

const outDir = path.join(__dirname, '..', 'public', 'email');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'pattern.png');
fs.writeFileSync(out, encodePNG(W, H, rgb));
console.log('Wrote', out, `(${W}x${H})`);
