import { defineSilentMountWithArgs } from '../silent-mount';
import { mountDropLine } from './drop-line';
// Fluid Functionalism f801409, registry/default/data-table.tsx header copy.
import { Effect, Schema } from 'effect';
import { CustomElement } from 'foldkit';
import { Point, pointProperty, copyTheme, trackPoint } from './ghost-surface';
import { copyVisual } from './visual-copy';
import './ghost.css';

export const Surface = CustomElement.define({
  tag: 'ff-data-table-column-ghost',
  properties: { [pointProperty]: Point },
  events: {},
});
export const Mounted = defineSilentMountWithArgs('DataTable.ColumnGhost', {
  args: { itemId: Schema.String },
  execute: ({ element, itemId }) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        element instanceof HTMLElement ? mountColumnGhost(element, itemId) : () => {},
      ),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
export function mountColumnGhost(host: HTMLElement, itemId: string): () => void {
  const root = host.parentElement?.closest<HTMLElement>('.ff-data-table');
  const viewport = root?.querySelector<HTMLElement>('.ff-data-table-scroll');
  const table = viewport?.querySelector<HTMLTableElement>(':scope > table');
  const head = root
    ?.querySelector<HTMLElement>(`[data-draggable-id="${CSS.escape(itemId)}"]`)
    ?.closest<HTMLElement>('th');
  if (!root || !viewport || !table || !head) return () => {};
  const doc = host.ownerDocument,
    rect = head.getBoundingClientRect();
  copyTheme(host, root, viewport);
  Object.assign(host.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
  const block = doc.createElement('div');
  block.className = 'ff-data-table-drag-block ff-data-table-column-copy';
  const copy = doc.createElement('table');
  copy.className = table.className;
  Object.assign(copy.style, {
    tableLayout: 'fixed',
    minWidth: '0',
    width: `${rect.width}px`,
    fontSize: getComputedStyle(table).fontSize,
    lineHeight: getComputedStyle(table).lineHeight,
  });
  copy.style.setProperty(
    '--table-cell-py',
    getComputedStyle(head).getPropertyValue('--table-cell-py'),
  );
  const part = doc.createElement('thead');
  const row = doc.createElement('tr');
  row.className = head.parentElement!.className;
  row.style.height = `${rect.height}px`;
  const cell = copyVisual(head);
  for (const name of [
    'data-dragged',
    'data-pinned',
    'data-pin-edge',
    'data-head-hover',
    'data-held',
  ])
    cell.removeAttribute(name);
  Object.assign(cell.style, {
    boxSizing: 'border-box',
    position: 'relative',
    left: 'auto',
    right: 'auto',
    width: `${rect.width}px`,
    minWidth: `${rect.width}px`,
    maxWidth: `${rect.width}px`,
  });
  row.append(cell);
  part.append(row);
  copy.append(part);
  block.append(copy);
  host.append(block);
  const originX = Number(
    root.dataset.dragOriginX ?? rect.left + Number(root.dataset.dragOffsetX ?? 0),
  );
  doc.body.append(host);
  const line = mountDropLine(viewport, table, 'column', [head.dataset.column!], head);
  const stopTracking = trackPoint(host, (point) => {
    line.paint(point.dropIndex);
    const box = viewport.getBoundingClientRect();
    const x = Math.min(Math.max(point.x - originX, box.left - rect.left), box.right - rect.right);
    host.style.transform = `translateX(${x}px)`;
  });
  return () => {
    stopTracking();
    line.dispose();
    host.remove();
  };
}
