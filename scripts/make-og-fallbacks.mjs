#!/usr/bin/env node
/**
 * make-og-fallbacks.mjs — generate the house OG fallback family.
 *
 * ~28% of the corpus arrives with no `og_image`, and a handful carry a
 * stringified empty array. For a site whose primary distribution channel is a
 * text message, a link with no preview image is a broken product — so every
 * page must resolve to SOMETHING.
 *
 * Six variants rather than one, assigned by a stable hash of the slug, so a
 * wall of fallbacks does not read as six hundred identical grey rectangles
 * while a given tool still always unfurls with the same card.
 *
 * JPEG, 1200x630, because iMessage and WhatsApp have both shipped versions
 * that silently ignore WebP, and `og:image:type` has to match the bytes.
 *
 * Rendered with ImageMagick at authoring time and COMMITTED — this is not a
 * build step. Run `pnpm og:fallbacks` only when the palette changes.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(import.meta.dirname, "..", "public", "og");
fs.mkdirSync(OUT, { recursive: true });

// Tier 1 house palette, mirrored from src/styles/theme.css.
const VARIANTS = [
  { ground: "#050005", a: "#04e5e5", b: "#9138e0" },
  { ground: "#0d0f14", a: "#6fffd6", b: "#04e5e5" },
  { ground: "#141019", a: "#9138e0", b: "#04e5e5" },
  { ground: "#050005", a: "#50a3b3", b: "#6fffd6" },
  { ground: "#0d0f14", a: "#04e5e5", b: "#50a3b3" },
  { ground: "#141019", a: "#6fffd6", b: "#9138e0" },
];

VARIANTS.forEach((v, i) => {
  const n = i + 1;
  const file = path.join(OUT, `fallback-${n}.jpg`);
  const args = [
    "-size", "1200x630",
    `xc:${v.ground}`,
    // Two soft radial washes in the house colours.
    "(", "-size", "1200x630", `radial-gradient:${v.a}-${v.ground}`,
    "-resize", "160%", "-gravity", "northwest", "-crop", "1200x630+0+0", "+repage",
    ")", "-compose", "screen", "-composite",
    "(", "-size", "1200x630", `radial-gradient:${v.b}-${v.ground}`,
    "-resize", "150%", "-gravity", "southeast", "-crop", "1200x630+0+0", "+repage",
    ")", "-compose", "screen", "-composite",
    "-modulate", "88,120,100",
    // A hairline rule and the wordmark, so the card is identifiably ours.
    "-fill", v.a, "-draw", "rectangle 72,540 200,543",
    "-font", "DejaVu-Sans", "-fill", "#eaf5f6", "-pointsize", "62", "-gravity", "northwest",
    "-annotate", "+72+430", "The Lossless Toolkit",
    "-font", "DejaVu-Sans", "-fill", v.a, "-pointsize", "26", "-gravity", "northwest",
    "-annotate", "+72+574", "lossless-toolkit  ·  tools we actually reach for",
    "-quality", "86",
    "-strip",
    file,
  ];
  execFileSync("magick", args, { stdio: "inherit" });
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
});
