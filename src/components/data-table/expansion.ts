// Fluid Functionalism f801409, data-table.tsx expansion layout effect.
import { Schema } from 'effect';
import { CustomElement } from 'foldkit';
import { copyVisual } from './visual-copy';
import { refreshLayout as refreshTable } from '../table/runtime';
import { refreshLayout as refreshFrozen } from './frozen';

export const expansionProperty = 'ffDataTableExpansion';
export const Surface = CustomElement.define({
  tag: 'ff-data-table-surface',
  properties: { [expansionProperty]: Schema.String },
  events: {},
});
const slide = { duration: 120, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

/** Capture before the view patches children, then project the source's short
 * layout transition. All copies are inert; Model remains the expansion owner. */
export function mountExpansion(root: HTMLElement) {
  type Row = { node: HTMLElement; id: string; top: number };
  type Snapshot = {
    rows: Row[];
    height: number;
    viewport: HTMLElement;
    ghosts: HTMLElement[];
  };
  let snapshot: Snapshot | undefined;
  let revision = 0;
  let disposed = false;
  const animations = new Set<Animation>();
  const ghosts = new Set<HTMLElement>();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stop = () => {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    ghosts.forEach((ghost) => ghost.remove());
    ghosts.clear();
  };
  const play = (node: Element, frames: Keyframe[], done?: () => void) => {
    const animation = node.animate(frames, slide);
    animations.add(animation);
    const finish = () => {
      animations.delete(animation);
      if (!disposed) done?.();
    };
    void animation.finished.then(finish, finish);
  };
  const capture = (value: string) => {
    stop();
    snapshot = undefined;
    if (reduced.matches) return;
    const viewport = root.querySelector<HTMLElement>('.ff-data-table-scroll'),
      table = viewport?.querySelector<HTMLTableElement>(':scope > table');
    if (!viewport || !table) return;
    const rows = [...table.querySelectorAll<HTMLElement>('tbody tr[data-row-id]')].map((node) => ({
      node,
      id: node.dataset.rowId!,
      top: node.offsetTop,
    }));
    const expanded = JSON.parse(value) as true | Record<string, boolean>;
    const copies: HTMLElement[] = [];
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index]!;
      if (row.node.dataset.expanded !== 'true' || expanded === true || expanded[row.id]) continue;
      const going: Row[] = [];
      while (
        index + 1 < rows.length &&
        Number(rows[index + 1]!.node.dataset.depth) > Number(row.node.dataset.depth)
      )
        going.push(rows[++index]!);
      if (!going.length) continue;
      const copy = table.cloneNode(false) as HTMLTableElement;
      copy.removeAttribute('id');
      copy.classList.add('ff-data-table-closing');
      copy.inert = true;
      copy.setAttribute('aria-hidden', 'true');
      Object.assign(copy.style, {
        position: 'absolute',
        left: '0',
        top: `${going[0]!.node.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop - viewport.clientTop}px`,
        width: `${table.offsetWidth}px`,
        tableLayout: 'fixed',
        pointerEvents: 'none',
        margin: '0',
      });
      const columns = root.ownerDocument.createElement('colgroup');
      for (const cell of going[0]!.node.children) {
        const column = root.ownerDocument.createElement('col');
        column.style.width = `${(cell as HTMLElement).offsetWidth}px`;
        columns.append(column);
      }
      const body = root.ownerDocument.createElement('tbody');
      for (const row of going) {
        const clone = copyVisual(row.node);
        body.append(clone);
      }
      copy.append(columns, body);
      copies.push(copy);
    }
    snapshot = { rows, height: viewport.offsetHeight, viewport, ghosts: copies };
  };
  const project = () => {
    const before = snapshot;
    snapshot = undefined;
    if (!before || disposed || reduced.matches) return;
    const { viewport } = before;
    const previous = new Map(before.rows.map((row) => [row.id, row.top]));
    const fresh: { node: HTMLElement; top: number; height: number }[] = [];
    const moved: { node: HTMLElement; dy: number }[] = [];
    let shift = 0,
      boundary = Infinity;
    for (const node of viewport.querySelectorAll<HTMLElement>(
      ':scope > table > tbody > tr[data-row-id]',
    )) {
      const old = previous.get(node.dataset.rowId!);
      if (old === undefined) fresh.push({ node, top: node.offsetTop, height: node.offsetHeight });
      else if (old !== node.offsetTop) {
        shift = old - node.offsetTop;
        boundary = Math.min(boundary, node.getBoundingClientRect().top);
        moved.push({ node, dy: shift });
      }
    }
    const height = viewport.offsetHeight;
    // Measure the patched rows before refreshing the overlays, which can
    // write classes and styles. The fills still need to snap before the
    // inverse transforms are applied.
    refreshTable(viewport);
    refreshFrozen(viewport);
    const fills = shift
      ? [
          ...root.querySelectorAll<HTMLElement>(
            '.ff-selection-background,.ff-data-table-selection-fades > .ff-data-table-fade-band',
          ),
        ].filter((node) => node.getBoundingClientRect().top >= boundary - 1)
      : [];
    for (const { node, dy } of moved)
      play(node, [{ translate: `0 ${dy}px` }, { translate: '0 0' }]);
    if (fresh.length) {
      const top = fresh[0]!.top,
        last = fresh[fresh.length - 1]!,
        span = last.top + last.height - top;
      for (const row of fresh) {
        const start = Math.min(1, Math.max(0, (row.top - top) / span));
        const end = Math.min(1, Math.max(start, (row.top + row.height - top) / span));
        const frames = [
          { clipPath: 'inset(0 0 100% 0)', opacity: 0, offset: 0 },
          ...(start > 0 ? [{ clipPath: 'inset(0 0 100% 0)', opacity: 0, offset: start }] : []),
          ...(end < 1 ? [{ clipPath: 'inset(0 0 0 0)', opacity: 1, offset: end }] : []),
          { clipPath: 'inset(0 0 0 0)', opacity: 1, offset: 1 },
        ];
        for (const cell of row.node.children) play(cell, frames);
      }
    }
    for (const fill of fills) play(fill, [{ translate: `0 ${shift}px` }, { translate: '0 0' }]);
    for (const ghost of before.ghosts) {
      viewport.append(ghost);
      ghosts.add(ghost);
      play(
        ghost,
        [
          { clipPath: 'inset(0 0 0 0)', opacity: 1 },
          { clipPath: 'inset(0 0 100% 0)', opacity: 0 },
        ],
        () => {
          ghost.remove();
          ghosts.delete(ghost);
          viewport.dispatchEvent(new Event('scroll'));
        },
      );
    }
    if (root.dataset.fill !== 'true' && before.height !== height)
      play(viewport, [{ height: `${before.height}px` }, { height: `${height}px` }]);
  };
  const descriptor = Object.getOwnPropertyDescriptor(root, expansionProperty);
  let value = (root as unknown as Record<string, string>)[expansionProperty] ?? '{}';
  Object.defineProperty(root, expansionProperty, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => value,
    set: (next: string) => {
      if (next !== value) {
        capture(next);
        value = next;
        // The property patches before the children. Project after that
        // synchronous patch, before the browser paints its new layout.
        // Waiting for rAF lets an earlier frame callback see the final rows
        // without their inverse transforms or reveal/closing copies.
        const expected = ++revision;
        queueMicrotask(() => {
          if (!disposed && revision === expected) project();
        });
      }
    },
  });
  return {
    pending: () => !!snapshot || animations.size > 0,
    dispose: () => {
      disposed = true;
      snapshot = undefined;
      revision++;
      stop();
      if (descriptor) Object.defineProperty(root, expansionProperty, { ...descriptor, value });
      else {
        delete (root as unknown as Record<string, string>)[expansionProperty];
        (root as unknown as Record<string, string>)[expansionProperty] = value;
      }
    },
  };
}
