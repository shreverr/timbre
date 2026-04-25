/**
 * Minimal allowlist-based SVG sanitizer for the embed widget's custom button
 * icon. We accept a small subset of SVG tags + attributes; everything else is
 * dropped. Returns null if the input doesn't parse as an `<svg>` root.
 *
 * This is intentionally conservative — for the icon use-case the user only
 * needs basic shape primitives. If they need more, we expand the allowlist.
 */

const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polygon",
  "polyline",
  "title",
  "defs",
]);

const ALLOWED_ATTRS = new Set([
  "viewBox",
  "xmlns",
  "width",
  "height",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "fill-rule",
  "clip-rule",
  "d",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "points",
  "transform",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "id",
  "class",
]);

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
const ATTR_RE = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;

function sanitizeAttrs(raw: string): string {
  let out = "";
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1]!;
    const value = m[3] ?? m[4] ?? "";
    if (!ALLOWED_ATTRS.has(name)) continue;
    if (/^on/i.test(name)) continue;
    if (/(javascript|data):/i.test(value)) continue;
    out += ` ${name}="${value.replace(/"/g, "&quot;")}"`;
  }
  return out;
}

export function sanitizeSvg(input: string): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^<svg\b/i.test(trimmed)) return null;
  if (/<script\b/i.test(trimmed)) return null;
  if (/\son[a-z]+\s*=/i.test(trimmed)) return null;
  if (/(javascript|data):/i.test(trimmed)) return null;

  let out = "";
  let depth = 0;
  let lastIndex = 0;
  for (const m of trimmed.matchAll(TAG_RE)) {
    const full = m[0]!;
    const tag = m[1]!.toLowerCase();
    const attrs = m[2] ?? "";
    const isClose = full.startsWith("</");
    const isSelfClose = full.endsWith("/>");

    // We discard any text between tags — icon SVGs don't need it, and dropping
    // it removes a vector for sneaky payloads.
    lastIndex = m.index! + full.length;

    if (!ALLOWED_TAGS.has(tag)) {
      // Skip disallowed tag entirely.
      continue;
    }

    if (isClose) {
      out += `</${tag}>`;
      depth = Math.max(0, depth - 1);
    } else if (isSelfClose) {
      out += `<${tag}${sanitizeAttrs(attrs)}/>`;
    } else {
      out += `<${tag}${sanitizeAttrs(attrs)}>`;
      depth++;
    }
  }

  if (!out.startsWith("<svg")) return null;
  return out;
}
