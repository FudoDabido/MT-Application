/**
 * Pure-Node PNG icon generator for MT Move Tracker.
 * No external dependencies — uses only Node built-ins.
 * Run once: node generate-icons.mjs
 */
import { createWriteStream } from 'fs';
import { deflateSync } from 'zlib';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const BG = [3, 7, 18];       // #030712 — gray-950
const FG = [16, 185, 129];   // #10b981 — emerald-500
const ICONS = [
  { name: 'icon-192.png',   size: 192 },
  { name: 'icon-512.png',   size: 512 },
  { name: 'icon-apple.png', size: 180 },
];

// ── Minimal PNG encoder ───────────────────────────────────────────────────────
function crc32(buf) {
  const table = Array.from({ length: 256 }, (_, i) => {
    let v = i;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    return v;
  });
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function writePNG(size, pixels, outPath) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB, no alpha

  const rowBytes = size * 3;
  const raw = Buffer.alloc((rowBytes + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (rowBytes + 1)] = 0; // filter = None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 3;
      const dst = y * (rowBytes + 1) + 1 + x * 3;
      raw[dst] = pixels[src]; raw[dst+1] = pixels[src+1]; raw[dst+2] = pixels[src+2];
    }
  }

  const idat = deflateSync(raw, { level: 6 });
  const sig  = Buffer.from([137,80,78,71,13,10,26,10]);
  const out  = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  const ws = createWriteStream(outPath);
  ws.write(out); ws.end();
  console.log(`  wrote ${outPath}`);
}

// ── Icon pixel builder ────────────────────────────────────────────────────────
const M = [[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1]];
const T = [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]];

function buildPixels(size) {
  const buf = new Uint8Array(size * size * 3);
  // Background
  for (let i = 0; i < size * size; i++) {
    buf[i*3]=BG[0]; buf[i*3+1]=BG[1]; buf[i*3+2]=BG[2];
  }
  // Rounded emerald badge
  const pad = Math.round(size * 0.12);
  const sq  = size - pad * 2;
  const r   = Math.round(sq * 0.22);
  for (let y = pad; y < size - pad; y++) {
    for (let x = pad; x < size - pad; x++) {
      const lx = x - pad, ly = y - pad;
      let inside = true;
      if      (lx < r && ly < r)           inside = Math.hypot(lx-r, ly-r) < r;
      else if (lx >= sq-r && ly < r)       inside = Math.hypot(lx-(sq-r), ly-r) < r;
      else if (lx < r && ly >= sq-r)       inside = Math.hypot(lx-r, ly-(sq-r)) < r;
      else if (lx >= sq-r && ly >= sq-r)   inside = Math.hypot(lx-(sq-r), ly-(sq-r)) < r;
      if (inside) { const i=(y*size+x)*3; buf[i]=FG[0]; buf[i+1]=FG[1]; buf[i+2]=FG[2]; }
    }
  }
  // "MT" letters in dark bg color
  const scale  = Math.max(1, Math.round(sq * 0.088));
  const gap    = Math.max(1, Math.round(sq * 0.06));
  const totalW = (5 * 2 + 1) * scale + gap;
  const ox     = pad + Math.round((sq - totalW) / 2);
  const oy     = pad + Math.round((sq - 5 * scale) / 2);
  for (const [letter, offX] of [[M, ox], [T, ox + 6*scale + gap]]) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (!letter[row][col]) continue;
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
          const px = offX + col*scale + dx, py = oy + row*scale + dy;
          if (px < 0 || py < 0 || px >= size || py >= size) continue;
          const i = (py*size+px)*3; buf[i]=BG[0]; buf[i+1]=BG[1]; buf[i+2]=BG[2];
        }
      }
    }
  }
  return buf;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const outDir = join(__dirname, 'public', 'icons');
await mkdir(outDir, { recursive: true });
console.log('Generating MT icons...');
for (const { name, size } of ICONS) {
  writePNG(size, buildPixels(size), join(outDir, name));
}
console.log('Done.');
