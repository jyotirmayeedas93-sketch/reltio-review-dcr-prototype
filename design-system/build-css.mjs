#!/usr/bin/env node
/*
 * Builds tokens.css from tokens.json (W3C Design Tokens format).
 *   node design-system/build-css.mjs
 *
 * - Every token becomes a CSS custom property; references become var() so the
 *   tier chain (primitive → alias → semantic → component) is kept in CSS.
 * - semantic tokens with a "dark" mode are emitted under [data-theme="dark"].
 * - responsive tokens with a "mobile" mode are emitted under a mobile media query.
 * - Deprecated tokens are skipped. Unresolved references fail the build.
 * No dependencies.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(here, "tokens.json"), "utf8"));

const MOBILE_QUERY = "(max-width: 767px)";
const FONT_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TIER_PREFIX = { accessibility: "a11y", typography: "typography" }; // other tiers drop their name

// ---------- collect ----------
const flat = new Map(); // dotted path -> token
(function walk(node, path) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith("$")) continue;
    const p = [...path, k];
    if (v && typeof v === "object" && "$value" in v) flat.set(p.join("."), v);
    else if (v && typeof v === "object") walk(v, p);
  }
})(tokens, []);

const cssName = (path) => {
  const [tier, ...rest] = path.split(".");
  const prefix = TIER_PREFIX[tier];
  return "--" + (prefix ? [prefix, ...rest] : rest).join("-");
};

const REF = /\{([^}]+)\}/g;
const errors = [];
function toCss(value, type, from) {
  if (typeof value === "string") {
    const out = value.replace(REF, (_, ref) => {
      const target = flat.get(ref);
      if (!target) errors.push(`${from}: unresolved reference {${ref}}`);
      else if (target.$deprecated) errors.push(`${from}: references deprecated {${ref}}`);
      return `var(${cssName(ref)})`;
    });
    if (type === "fontFamily" && !value.includes("{")) return `"${value}", ${FONT_FALLBACK}`;
    return out;
  }
  if (typeof value === "number") return String(value);
  if (type === "typography") {
    const v = (x) => toCss(x, "", from);
    return `${v(value.fontWeight)} ${v(value.fontSize)}/${v(value.lineHeight)} ${v(value.fontFamily)}`;
  }
  return String(value);
}

// ---------- emit ----------
const blocks = { root: [], dark: [], mobile: [] };
const names = new Map();
for (const path of flat.keys()) {
  const n = cssName(path);
  if (names.has(n)) errors.push(`name clash: ${path} and ${names.get(n)} both map to ${n}`);
  names.set(n, path);
}
let tierSeen = "";
for (const [path, t] of flat) {
  if (t.$deprecated) continue;
  const tier = path.split(".")[0];
  if (tier !== tierSeen) { blocks.root.push(`\n  /* ${tier} */`); tierSeen = tier; }
  const name = cssName(path);
  blocks.root.push(`  ${name}: ${toCss(t.$value, t.$type, path)};`);
  if (t.$type === "typography" && t.$value.textDecoration) blocks.root.push(`  ${name}-decoration: ${t.$value.textDecoration};`);
  const modes = t.$extensions?.modes || {};
  if (modes.dark !== undefined) blocks.dark.push(`  ${name}: ${toCss(modes.dark, t.$type, path + "@dark")};`);
  if (modes.mobile !== undefined) blocks.mobile.push(`    ${name}: ${toCss(modes.mobile, t.$type, path + "@mobile")};`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const css = `/*
 * Build Design System — design tokens
 * GENERATED from tokens.json by build-css.mjs. Do not edit by hand.
 * Source: Figma "Build Design System" (9gbh6BJ4Kcxp2CeMVhSJPE)
 *
 * Light mode and desktop sizes are the defaults.
 * Dark mode:  <html data-theme="dark">
 * Mobile type sizes apply at ${MOBILE_QUERY}.
 */
:root {${blocks.root.join("\n")}
}

[data-theme="dark"] {
${blocks.dark.join("\n")}
}

@media ${MOBILE_QUERY} {
  :root {
${blocks.mobile.join("\n")}
  }
}
`;
writeFileSync(join(here, "tokens.css"), css);
const count = blocks.root.filter((l) => l.trim().startsWith("--")).length;
console.log(`tokens.css: ${count} properties, ${blocks.dark.length} dark overrides, ${blocks.mobile.length} mobile overrides`);
