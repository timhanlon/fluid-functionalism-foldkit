import { defineSilentMountWithArgs } from '../silent-mount';
import { mountDropLine } from './drop-line';
// Fluid Functionalism f801409, registry/default/data-table.tsx rowGhost.
import { Effect, Schema } from 'effect';
import { CustomElement, Mount } from 'foldkit';
import { copyVisual } from './visual-copy';
import './ghost.css';

import { Point, pointProperty, copyTheme, trackPoint } from './ghost-surface';

export const Surface = CustomElement.define({
  tag: 'ff-data-table-row-ghost',
  properties: { [pointProperty]: Point },
  events: {},
});
export const Mounted = defineSilentMountWithArgs('DataTable.RowGhost', {
  args: { itemId: Schema.String, rowIds: Schema.Array(Schema.String) },
  execute: ({ element, itemId, rowIds }) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        element instanceof HTMLElement ? mountRowGhost(element, itemId, rowIds) : () => {},
      ),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});

/** The SDK owns pointer state, collision, dropping and cancellation. This
 * Mount only copies current paint and projects its current pointer position. */
export function mountRowGhost(
  host: HTMLElement,
  itemId: string,
  rowIds: readonly string[],
): () => void {
  const root = host.parentElement?.closest<HTMLElement>('.ff-data-table');
  const viewport = root?.querySelector<HTMLElement>('.ff-data-table-scroll');
  const table = viewport?.querySelector<HTMLTableElement>(':scope > table');
  const source = root
    ?.querySelector<HTMLElement>(`[data-draggable-id="${CSS.escape(itemId)}"]`)
    ?.closest<HTMLElement>('tr');
  if (!root || !viewport || !table || !source) return () => {};
  const doc = host.ownerDocument;
  const rows = [...table.querySelectorAll<HTMLElement>('tbody tr[data-row-id]')].filter(
    (row) => row.closest('table') === table,
  );
  const ids = new Set(rowIds);
  let include = false;
  const marked = rows.filter((row) => {
    if (row.dataset.depth === '0') include = ids.has(row.dataset.rowId!);
    return include;
  });
  if (!marked.length) return () => {};
  const boxes = marked.map((row) => row.getBoundingClientRect());
  const rect = source.getBoundingClientRect(),
    box = viewport.getBoundingClientRect();
  const first = boxes[0]!.top;
  const span = boxes[boxes.length - 1]!.bottom - first;
  const room = Math.max(rect.height, doc.defaultView!.innerHeight * 0.6);
  const cut = span > room;
  copyTheme(host, root, viewport);
  Object.assign(host.style, {
    top: `${cut ? rect.top : first}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    height: `${Math.min(span, room)}px`,
  });
  let at = 0;
  const carried = (cut ? [source, ...marked.filter((row) => row !== source)] : marked).map(
    (row) => {
      const index = marked.indexOf(row),
        height = boxes[index]!.height;
      const item = { row, top: cut ? at : boxes[index]!.top - first, height };
      at += height;
      return item;
    },
  );
  const runs: (typeof carried)[] = [];
  for (const item of carried) {
    const run = runs[runs.length - 1],
      last = run?.[run.length - 1];
    if (last && Math.abs(last.top + last.height - item.top) < 1) run!.push(item);
    else runs.push([item]);
  }
  const slot = doc.createElement('div');
  slot.className = 'ff-data-table-row-copy';
  const blocks = runs.map((run) => {
    const block = doc.createElement('div');
    block.className = 'ff-data-table-drag-block';
    Object.assign(block.style, {
      top: `${run[0]!.top}px`,
      height: `${run.reduce((sum, item) => sum + item.height, 0)}px`,
    });
    const copy = doc.createElement('table');
    copy.className = table.className;
    Object.assign(copy.style, {
      tableLayout: 'fixed',
      minWidth: '0',
      width: `${source.offsetWidth}px`,
    });
    copy.style.setProperty(
      '--table-cell-py',
      getComputedStyle(source).getPropertyValue('--table-cell-py'),
    );
    copy.style.fontSize = getComputedStyle(table).fontSize;
    copy.style.lineHeight = getComputedStyle(table).lineHeight;
    const body = doc.createElement('tbody');
    for (const { row: from } of run) {
      const row = copyVisual(from);
      [...row.children].forEach((cell, index) => {
        const origin = from.children[index] as HTMLElement,
          css = getComputedStyle(origin);
        const width = `${origin.getBoundingClientRect().width}px`;
        Object.assign((cell as HTMLElement).style, {
          boxSizing: 'border-box',
          width,
          minWidth: width,
          maxWidth: width,
        });
        (cell as HTMLElement).style.setProperty(
          '--expander-pl',
          css.getPropertyValue('--expander-pl'),
        );
      });
      row
        .querySelectorAll<HTMLElement>('.ff-checkbox-item')
        .forEach((node) => node.style.setProperty('opacity', '1', 'important'));
      row.querySelectorAll<HTMLElement>('.ff-data-table-row-handle').forEach((node) => {
        node.style.display = from === source ? 'flex' : 'none';
        node.style.setProperty('opacity', '1', 'important');
      });
      body.append(row);
    }
    copy.append(body);
    block.append(copy);
    return block;
  });
  slot.append(...blocks);
  host.append(slot);
  if (cut) {
    const count = doc.createElement('span');
    count.className = 'ff-data-table-drag-count';
    count.textContent = `${rowIds.length} rows`;
    host.append(count);
  }
  const previous = marked.map((row) => row.getAttribute('data-row-dragging'));
  marked.forEach((row) => row.setAttribute('data-row-dragging', ''));
  const originY = Number(
    root.dataset.dragOriginY ?? rect.top + Number(root.dataset.dragOffsetY ?? 0),
  );
  const paint = (point: Point) => {
    line.paint(point.dropIndex);
    const top = rows[0]!.getBoundingClientRect().top,
      bottom = rows[rows.length - 1]!.getBoundingClientRect().bottom;
    const y =
      Math.min(Math.max(rect.top + point.y - originY, top), bottom - rect.height) - rect.top;
    host.style.transform = `translateY(${y}px)`;
  };
  // A property carries the SDK's current point; no native pointer listener or
  // second drag machine is introduced by this visual projection.
  doc.body.append(host);
  // The source gives the line the same layer as the copy, after it in paint order.
  const line = mountDropLine(viewport, table, 'row', rowIds);
  blocks.forEach((block) => (block.scrollLeft = viewport.scrollLeft));
  const stopTracking = trackPoint(host, paint);
  return () => {
    stopTracking();
    line.dispose();
    marked.forEach((row, index) =>
      previous[index] === null
        ? row.removeAttribute('data-row-dragging')
        : row.setAttribute('data-row-dragging', previous[index]!),
    );
    host.remove();
  };
}
