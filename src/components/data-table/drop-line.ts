// Fluid Functionalism f801409 data-table.tsx row/column landing lines.
import { copyTheme } from './ghost-surface';
import { placementAtBoundary } from './reorder';

/** Paint the SDK's insertion boundary. This never hit-tests or changes a target. */
export function mountDropLine(
  viewport: HTMLElement,
  table: HTMLTableElement,
  kind: 'row' | 'column',
  moving: readonly string[],
  head?: HTMLElement,
) {
  const root = viewport.closest<HTMLElement>('.ff-data-table')!;
  const line = table.ownerDocument.createElement('div');
  line.className = `ff-data-table-drop-line ff-data-table-drop-line-${kind}`;
  line.inert = true;
  line.setAttribute('aria-hidden', 'true');
  copyTheme(line, root, viewport);
  line.style.display = 'none';
  const header = head?.getBoundingClientRect();
  const height = header
    ? Math.max(
        header.height,
        Math.min(viewport.getBoundingClientRect().bottom, table.getBoundingClientRect().bottom) -
          header.top,
      )
    : 0;
  table.ownerDocument.body.append(line);
  return {
    paint(index: number | undefined) {
      line.style.display = 'none';
      if (index === undefined) return;
      const targets = [
        ...table.querySelectorAll<HTMLElement>(
          kind === 'row' ? ':scope > tbody[data-row-group]' : 'thead th[data-sortable-id]',
        ),
      ];
      if (!targets.length || !Number.isInteger(index) || index < 0 || index > targets.length)
        return;
      const ids = targets.map((target) =>
        kind === 'row' ? target.dataset.rowGroup! : target.dataset.column!,
      );
      const reference = targets[Math.min(index, targets.length - 1)]!;
      if (
        kind === 'row'
          ? !placementAtBoundary(ids, moving, index)
          : moving.includes(reference.dataset.column!)
      )
        return;
      const box = viewport.getBoundingClientRect(),
        edge = reference.getBoundingClientRect();
      line.style.display = 'block';
      if (kind === 'row')
        Object.assign(line.style, {
          left: `${box.left}px`,
          top: `${(index < targets.length ? edge.top : edge.bottom) - 1}px`,
          width: `${box.width}px`,
        });
      else
        Object.assign(line.style, {
          left: `${Math.min(Math.max(index < targets.length ? edge.left : edge.right, box.left), box.right) - 1}px`,
          top: `${header!.top}px`,
          height: `${height}px`,
        });
    },
    dispose: () => line.remove(),
  };
}
