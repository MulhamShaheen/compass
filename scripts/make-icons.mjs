/**
 * Renders the app icons from the compass-rose logo with Playwright.
 * Usage: node scripts/make-icons.mjs   (writes public/icons/*.png and src/app/icon.svg)
 * Colors here mirror the "Night City" tokens in src/styles/tokens.css; icons cannot read CSS variables.
 */
import fs from "node:fs";
import { chromium } from "@playwright/test";

const C = { bg: "#07090d", ring: "#5ef6ff", line: "#22303a", red: "#ff2a4d", brass: "#fcee0a", muted: "#7d939b" };

const rose = (scale = 1) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <g transform="translate(24 24) scale(${scale}) translate(-24 -24)">
    <circle cx="24" cy="24" r="22" fill="none" stroke="${C.ring}" stroke-width="1.2" stroke-dasharray="5 3"/>
    <circle cx="24" cy="24" r="17" fill="none" stroke="${C.line}" stroke-width="1.2"/>
    <path d="M24 5 L28 24 L24 43 L20 24Z" fill="${C.red}"/>
    <path d="M24 5 L28 24 L20 24Z" fill="${C.brass}"/>
    <path d="M6 24 L24 21.5 L42 24 L24 26.5Z" fill="${C.muted}" opacity=".45"/>
    <circle cx="24" cy="24" r="2.5" fill="${C.bg}" stroke="${C.ring}"/>
  </g>
</svg>`;

// Favicon: transparent background, full size.
fs.writeFileSync("src/app/icon.svg", rose(1).trim() + "\n");

const icons = [
  { file: "public/icons/icon-192.png", size: 192, scale: 0.82 },
  { file: "public/icons/icon-512.png", size: 512, scale: 0.82 },
  // Maskable icons keep the art inside the central safe zone (80%).
  { file: "public/icons/maskable-512.png", size: 512, scale: 0.62 },
  { file: "src/app/apple-icon.png", size: 180, scale: 0.78 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const { file, size, scale } of icons) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:${C.bg};display:grid;place-items:center;width:${size}px;height:${size}px">
       <div style="width:${size}px;height:${size}px">${rose(scale).replace("<svg ", `<svg width="${size}" height="${size}" `)}</div>
     </body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: false });
  console.log("wrote", file);
}
await browser.close();
