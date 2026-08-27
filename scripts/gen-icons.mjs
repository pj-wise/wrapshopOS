import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

async function make(size, name, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/><text x="50%" y="50%" font-family="system-ui,sans-serif" font-size="${Math.round(size * 0.55)}" fill="white" text-anchor="middle" dominant-baseline="central" font-weight="700">W</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`${outDir}/${name}`);
}

await Promise.all([
  make(192, "icon-192.png", "#0a0a0a"),
  make(512, "icon-512.png", "#0a0a0a"),
  make(192, "icon-maskable-192.png", "#0a0a0a"),
  make(512, "icon-maskable-512.png", "#0a0a0a"),
  make(180, "apple-touch-icon.png", "#0a0a0a"),
]);
console.log("icons ready →", outDir);
