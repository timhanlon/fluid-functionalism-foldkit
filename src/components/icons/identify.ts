import { untitled, lucide, type IconName } from './data';
interface SvgNode {
  readonly tag: string;
  readonly attrs: Readonly<Record<string, string>>;
  readonly children: readonly (SvgNode | string)[];
}
const geometry = new Set([
  'd',
  'cx',
  'cy',
  'r',
  'x',
  'y',
  'x1',
  'x2',
  'y1',
  'y2',
  'width',
  'height',
  'rx',
  'ry',
  'points',
  'fill',
  'transform',
]);
function signature(
  nodes: readonly (readonly [string, Readonly<Record<string, string>>])[],
): string {
  return JSON.stringify(
    nodes.map(([tag, attrs]) => [
      tag,
      Object.entries(attrs)
        .filter(([key]) => geometry.has(key))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => [key, value.replace(/[\s,]+/g, '')]),
    ]),
  );
}
const names = new Map<string, IconName>();
for (const definitions of [untitled, lucide])
  for (const [name, nodes] of Object.entries(definitions))
    names.set(signature(nodes), name as IconName);
/** Identify captured project glyphs by geometry, leaving artwork and custom
 * marks intact. The renderer then uses the same library slots as components. */
export function identifyIcon(node: SvgNode): IconName | undefined {
  const viewBox = node.attrs.viewBox ?? node.attrs.viewbox;
  if (viewBox && viewBox !== '0 0 24 24') return;
  if (
    node.children.some(
      (child) => typeof child !== 'string' && child.tag === 'g' && child.attrs.transform,
    )
  )
    return;
  const shapes = (
    children: SvgNode['children'],
  ): (readonly [string, Readonly<Record<string, string>>])[] =>
    children.flatMap((child) =>
      typeof child === 'string'
        ? []
        : child.tag === 'g'
          ? shapes(child.children)
          : [[child.tag, child.attrs] as const],
    );
  return names.get(signature(shapes(node.children)));
}
