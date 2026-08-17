// Generates the PWA icons *and* the APK launcher icons from pure pixel math —
// no image libraries, no binary blobs checked in by hand.
// Re-run with:  node tools/gen-icons.mjs
//
// The mark is the same shape the app uses for its month-progress ring: an open
// ring with a solid centre dot, on the brand teal, in a rounded square.
//
// Outputs:
//   icons/                                   the PWA / favicon set
//   android/app/src/main/res/mipmap-*/        the APK launcher icons
//     ic_launcher.png             legacy square icon (API 25 and below)
//     ic_launcher_foreground.png  adaptive-icon foreground, transparent, mark only
//   (the adaptive-icon background is a flat brand-teal shape drawable, checked
//    in as XML — see res/drawable/ic_launcher_background.xml)

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'icons');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');

const BRAND = [15, 118, 110];   // #0f766e
const INK = [255, 255, 255];

// ---------------------------------------------------------------- png writer
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                                  // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ the mark
// `pad` leaves safe-area room so the same art works as a maskable icon.
// `box: false` drops the teal rounded square and draws the ring alone on
// transparency — that is what an adaptive-icon foreground layer needs, since
// Android supplies the background layer itself.
function drawIcon(size, pad = 0, { box: drawBox = true, ink = INK } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  const box = size * (1 - pad);                 // side of the rounded square
  const half = box / 2;
  const radius = box * 0.22;                    // corner radius
  const ringR = box * 0.30;                     // ring centre-line radius
  const ringW = box * 0.085;                    // ring stroke width
  const dotR = box * 0.105;
  const SS = 3;                                 // supersampling per axis

  const put = (i, rgb, a) => {
    const [r, g, b] = rgb;
    const ia = 1 - a;
    px[i] = Math.round(px[i] * ia + r * a);
    px[i + 1] = Math.round(px[i + 1] * ia + g * a);
    px[i + 2] = Math.round(px[i + 2] * ia + b * a);
    px[i + 3] = Math.round(px[i + 3] * ia + 255 * a);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inBox = 0, inRing = 0, inDot = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px_ = x + (sx + 0.5) / SS - c;
          const py_ = y + (sy + 0.5) / SS - c;
          // rounded square (signed distance)
          const qx = Math.abs(px_) - (half - radius);
          const qy = Math.abs(py_) - (half - radius);
          const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
            + Math.min(Math.max(qx, qy), 0) - radius;
          if (d <= 0) inBox++;
          const r = Math.hypot(px_, py_);
          if (Math.abs(r - ringR) <= ringW / 2) inRing++;
          if (r <= dotR) inDot++;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      if (drawBox && inBox) put(i, BRAND, inBox / n);
      if (inRing) put(i, ink, inRing / n);
      if (inDot) put(i, ink, inDot / n);
    }
  }
  return encodePng(size, size, px);
}

mkdirSync(OUT, { recursive: true });
const files = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.2],
  ['apple-touch-icon.png', 180, 0],
  ['favicon-64.png', 64, 0],
];
for (const [name, size, pad] of files) {
  writeFileSync(join(OUT, name), drawIcon(size, pad));
  console.log('wrote icons/' + name);
}

// ------------------------------------------------------- APK launcher icons
// Densities: the legacy icon is 48dp, the adaptive foreground canvas is 108dp.
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

// Adaptive icons mask everything outside the central 66dp of the 108dp canvas,
// so the mark has to live inside 66/108 ≈ 0.611 of the width. The ring's outer
// diameter is 0.685 of `box`, so box = 0.85·size puts it at 0.582 — inside the
// safe zone with room to spare, and the same optical weight as the PWA icon.
const FOREGROUND_PAD = 0.15;

for (const [density, scale] of DENSITIES) {
  const dir = join(RES, 'mipmap-' + density);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ic_launcher.png'), drawIcon(Math.round(48 * scale), 0));
  writeFileSync(
    join(dir, 'ic_launcher_foreground.png'),
    drawIcon(Math.round(108 * scale), FOREGROUND_PAD, { box: false }),
  );
  console.log('wrote android .../mipmap-' + density + '/ic_launcher{,_foreground}.png');
}
