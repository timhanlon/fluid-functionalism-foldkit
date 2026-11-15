/* Upstream ColorPicker's color math, function for function. The picker holds
 * one color as HSV + alpha and derives every format from it: HSV is the
 * saturation square's own coordinate system, and keeping H in state lets the
 * hue survive a pass through gray or black, where RGB has no hue to give
 * back. No DOM here except resolveCssColor. */

export const formats = ['hex', 'rgb', 'hsl', 'oklch'] as const;
export type ColorFormat = (typeof formats)[number];
export const formatLabels: Record<ColorFormat, string> = {
  hex: 'HEX',
  rgb: 'RGB',
  hsl: 'HSL',
  oklch: 'OKLCH',
};

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}
export interface ParsedColor {
  /** HSV, canonical: 0..360 / 0..1 / 0..1. */
  readonly h: number;
  readonly s: number;
  readonly v: number;
  readonly a: number;
  /** sRGB 0..255, rounded. */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly hex: string;
  readonly rgb: string;
  readonly hsl: string;
  readonly oklch: string;
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const clamp255 = (n: number) => Math.max(0, Math.min(255, n));

/** Hue wraps into 0..360 first. Output channels are unrounded 0..255. */
export function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/** A color with no chroma returns h = 0 and s = 0; callers substitute their
 * own hue when s === 0. */
export function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v: max };
}

export function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  const l = (max + min) / 2,
    d = max - min;
  let h = 0,
    s = 0;
  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0,
    g = 0,
    b = 0;
  if (hh < 1) [r, g] = [c, x];
  else if (hh < 2) [r, g] = [x, c];
  else if (hh < 3) [g, b] = [c, x];
  else if (hh < 4) [g, b] = [x, c];
  else if (hh < 5) [r, b] = [x, c];
  else [r, b] = [c, x];
  const m = l - c / 2;
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

const srgbToLinear = (c: number) => {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const linearToSrgb = (c: number) =>
  clamp01(c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255;

/** Björn Ottosson's OKLab matrices. */
function linearRgbToOklab(r: number, g: number, b: number) {
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}
function oklabToLinearRgb(L: number, a: number, b: number) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

export function rgbToOklch(r: number, g: number, b: number) {
  const lab = linearRgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: lab.L, C, H };
}
/** Out-of-gamut input clips per channel instead of reducing chroma. */
export function oklchToRgb(L: number, C: number, H: number) {
  const lin = oklabToLinearRgb(
    L,
    C * Math.cos((H * Math.PI) / 180),
    C * Math.sin((H * Math.PI) / 180),
  );
  return {
    r: clamp255(linearToSrgb(lin.r)),
    g: clamp255(linearToSrgb(lin.g)),
    b: clamp255(linearToSrgb(lin.b)),
  };
}

const to2hex = (n: number) => Math.round(clamp255(n)).toString(16).padStart(2, '0');
/** Alpha is appended only below 1. Also the swatch-matching normalizer. */
export const rgbToHexStr = (r: number, g: number, b: number, a: number) =>
  `#${to2hex(r)}${to2hex(g)}${to2hex(b)}${a >= 1 ? '' : to2hex(a * 255)}`;

/** 3, 4, 6 or 8 digits, "#" optional. */
export function parseHex(input: string): Rgba | null {
  const match = input.trim().match(/^#?([0-9a-fA-F]{3,8})$/);
  if (!match) return null;
  let hex = match[1]!;
  if (hex.length === 3 || hex.length === 4)
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  const byte = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  if (hex.length === 6) return { r: byte(0), g: byte(2), b: byte(4), a: 1 };
  if (hex.length === 8) return { r: byte(0), g: byte(2), b: byte(4), a: byte(6) / 255 };
  return null;
}

const fraction = (part: string) => (part.endsWith('%') ? parseFloat(part) / 100 : parseFloat(part));
const partsOf = (body: string) => body.split(/[\s,/]+/).filter(Boolean);

/** Reads hex, rgb()/rgba(), hsl()/hsla() and oklch(). Commas, spaces and "/"
 * separate parts; alpha takes 0..1 or a percentage. Pure string work. */
export function parseColor(input: string): Rgba | null {
  const s = input.trim();
  if (!s) return null;
  if (s.startsWith('#') || /^[0-9a-fA-F]{3,8}$/.test(s)) return parseHex(s);
  const alphaOf = (parts: readonly string[]) => (parts[3] === undefined ? 1 : fraction(parts[3]));
  const rgbMatch = s.match(/^rgba?\(\s*([^)]+)\)$/i);
  if (rgbMatch) {
    const parts = partsOf(rgbMatch[1]!);
    if (parts.length < 3) return null;
    const [r, g, b] = parts.map(parseFloat) as [number, number, number],
      a = alphaOf(parts);
    if ([r, g, b, a].some(Number.isNaN)) return null;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: clamp01(a) };
  }
  const hslMatch = s.match(/^hsla?\(\s*([^)]+)\)$/i);
  if (hslMatch) {
    const parts = partsOf(hslMatch[1]!);
    if (parts.length < 3) return null;
    const h = parseFloat(parts[0]!),
      sat = fraction(parts[1]!),
      l = fraction(parts[2]!),
      a = alphaOf(parts);
    if ([h, sat, l, a].some(Number.isNaN)) return null;
    const rgb = hslToRgb(h, clamp01(sat), clamp01(l));
    return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a: clamp01(a) };
  }
  const oklchMatch = s.match(/^oklch\(\s*([^)]+)\)$/i);
  if (oklchMatch) {
    const parts = partsOf(oklchMatch[1]!);
    if (parts.length < 3) return null;
    const L = fraction(parts[0]!),
      C = parseFloat(parts[1]!),
      H = parseFloat(parts[2]!),
      a = alphaOf(parts);
    if ([L, C, H, a].some(Number.isNaN)) return null;
    const rgb = oklchToRgb(clamp01(L), Math.max(0, C), H);
    return { r: clamp255(rgb.r), g: clamp255(rgb.g), b: clamp255(rgb.b), a: clamp01(a) };
  }
  return null;
}

let cssColorContext: CanvasRenderingContext2D | null = null;
/** Named CSS colors ("tomato") through a canvas round-trip; browser only. An
 * invalid assignment leaves fillStyle untouched, so two starting values
 * detect rejection. */
export function resolveCssColor(input: string): Rgba | null {
  const direct = parseColor(input);
  if (direct) return direct;
  const s = input.trim();
  if (!s || typeof document === 'undefined') return null;
  cssColorContext ??= document.createElement('canvas').getContext('2d');
  const context = cssColorContext;
  if (!context) return null;
  context.fillStyle = '#000000';
  context.fillStyle = s;
  const first = String(context.fillStyle);
  context.fillStyle = '#ffffff';
  context.fillStyle = s;
  if (first !== String(context.fillStyle)) return null;
  return parseColor(first);
}

const alphaText = (a: number) => String(Number(a.toFixed(3)));
/** Every string comes from the one HSV tuple. RGB/HSL round to integers;
 * OKLCH prints L% to 1 decimal, C to 3, H to 1; alpha only below 1. */
export function buildParsed(h: number, s: number, v: number, a: number): ParsedColor {
  const { r, g, b } = hsvToRgb(h, s, v);
  const hsl = rgbToHsl(r, g, b),
    oklch = rgbToOklch(r, g, b);
  const [R, G, B] = [r, g, b].map(Math.round) as [number, number, number];
  const hslBody = `${Math.round(hsl.h)}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%`;
  const oklchBody = `${(oklch.L * 100).toFixed(1)}% ${oklch.C.toFixed(3)} ${oklch.H.toFixed(1)}`;
  return {
    h,
    s,
    v,
    a,
    r: R,
    g: G,
    b: B,
    hex: rgbToHexStr(r, g, b, a),
    rgb: a >= 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alphaText(a)})`,
    hsl: a >= 1 ? `hsl(${hslBody})` : `hsla(${hslBody}, ${alphaText(a)})`,
    oklch: a >= 1 ? `oklch(${oklchBody})` : `oklch(${oklchBody} / ${alphaText(a)})`,
  };
}

export const formatValue = (parsed: ParsedColor, format: ColorFormat) => parsed[format];
