#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SOURCE = resolve(ROOT, "icons/icon.svg");

const targets = [
  { path: "icons/icon-192.png", size: 192 },
  { path: "icons/icon-512.png", size: 512 },
  { path: "icons/apple-touch-icon.png", size: 180 },
  { path: "icons/favicon-32.png", size: 32 },
];

const svg = readFileSync(SOURCE);

for (const { path, size } of targets) {
  const out = resolve(ROOT, path);
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`Wrote ${path} (${size}x${size})`);
}
