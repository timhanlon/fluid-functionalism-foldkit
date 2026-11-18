import { Schema } from 'effect';

export const Point = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  dropIndex: Schema.optionalKey(Schema.Number),
});
export type Point = typeof Point.Type;
export const pointProperty = 'ffDataTableDragPoint';

/** A portal retains its source tokens and preferences even inside a themed subtree. */
export function copyTheme(host: HTMLElement, root: HTMLElement, viewport: HTMLElement) {
  const style = getComputedStyle(viewport);
  for (let index = 0; index < style.length; index++) {
    const name = style.item(index);
    if (name.startsWith('--')) host.style.setProperty(name, style.getPropertyValue(name));
  }
  host.style.colorScheme = style.colorScheme;
  for (const name of ['size', 'radius', 'align']) host.dataset[name] = root.dataset[name];
}

/** Project the SDK's public point property; listen only for layout scrolling,
 * never native pointer movement. The caller retains the portal lifetime. */
export function trackPoint(host: HTMLElement, paint: (point: Point) => void) {
  const descriptor = Object.getOwnPropertyDescriptor(host, pointProperty);
  let point = (host as unknown as Record<string, Point>)[pointProperty]!;
  const refresh = () => paint(point);
  Object.defineProperty(host, pointProperty, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => point,
    set: (next: Point) => {
      point = next;
      refresh();
    },
  });
  host.ownerDocument.addEventListener('scroll', refresh, { capture: true, passive: true });
  refresh();
  return () => {
    host.ownerDocument.removeEventListener('scroll', refresh, { capture: true });
    if (descriptor) Object.defineProperty(host, pointProperty, { ...descriptor, value: point });
    else delete (host as unknown as Record<string, Point>)[pointProperty];
  };
}
