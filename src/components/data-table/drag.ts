import { Option } from 'effect';
import type { Html, HtmlBuilder } from 'foldkit/html';
import type { Row, Table } from '@tanstack/table-core';
import type { Model, Message } from './state';
import { displayedRows } from './engine';
import * as RowGhost from './row-ghost';
import * as ColumnGhost from './column-ghost';

/** The source row and its selected peers on this page travel together. Use
 * identity rather than its old index if the view holds a different order. */
export function carriedRows<T>(model: Model, rows: readonly Row<T>[]): readonly Row<T>[] {
  const drag = model.rowDrag.dragState;
  if (drag._tag !== 'Dragging') return [];
  const source = rows.find(
    (row) => `${model.id}-row-${encodeURIComponent(row.id)}` === drag.itemId,
  );
  if (!source || source.depth !== 0) return [];
  return source.getIsSelected()
    ? rows.filter((row) => row.depth === 0 && row.getIsSelected())
    : [source];
}

export function ghosts<T>(model: Model, table: Table<T>, h: HtmlBuilder<Message>): readonly Html[] {
  const result: Html[] = [];
  const column = model.columnDrag.dragState;
  if (column._tag === 'Dragging') {
    const ghost = ColumnGhost.Surface.withMessage(h);
    const target = Option.getOrUndefined(column.maybeDropTarget);
    result.push(
      ghost(
        [
          h.Key('column-ghost'),
          h.AriaHidden(true),
          h.Inert(true),
          h.Class('ff-data-table ff-data-table-ghost ff-data-table-column-ghost'),
          ghost.FfDataTableDragPoint({
            x: column.current.clientX,
            y: column.current.clientY,
            ...(target?.containerId === model.columnDrag.id ? { dropIndex: target.index } : {}),
          }),
          h.OnMount(ColumnGhost.Mounted({ itemId: column.itemId })),
        ],
        [],
      ),
    );
  }
  const row = model.rowDrag.dragState;
  if (row._tag === 'Dragging') {
    const carried = carriedRows(model, displayedRows(table, model.heldOrder));
    const ghost = RowGhost.Surface.withMessage(h);
    const target = Option.getOrUndefined(row.maybeDropTarget);
    result.push(
      ghost(
        [
          h.Key('row-ghost'),
          h.AriaHidden(true),
          h.Inert(true),
          h.Class('ff-data-table ff-data-table-ghost ff-data-table-row-ghost'),
          ghost.FfDataTableDragPoint({
            x: row.current.clientX,
            y: row.current.clientY,
            ...(target?.containerId === model.rowDrag.id ? { dropIndex: target.index } : {}),
          }),
          h.OnMount(RowGhost.Mounted({ itemId: row.itemId, rowIds: carried.map((row) => row.id) })),
        ],
        [],
      ),
    );
  }
  return result;
}
