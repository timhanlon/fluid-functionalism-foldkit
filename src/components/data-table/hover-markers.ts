import type { Column, Row } from '@tanstack/table-core';
import type { HtmlBuilder } from 'foldkit/html';
import type { HoverMarker } from '../table';
import { icon } from '../icons';
import type { Props } from './types';
import type { Message } from './state';

/** Source utility slots are leading: a grip, then an empty selection box.
 * Other column arrangements retain each row's ordinary controls. */
export function markerColumns<T>(columns: readonly Column<T>[], props: Props<T>) {
  const select = columns.findIndex((column) => column.id === 'select');
  return {
    reorder: !!props.reorderRows && !props.loading && columns[0]?.id === 'drag',
    boxLeft: select === 0 ? 8 : select === 1 && columns[0]?.id === 'drag' ? 28 : -1,
  };
}
export function hoverMarkers<T>(
  rows: readonly Row<T>[],
  columns: readonly Column<T>[],
  props: Props<T>,
  h: HtmlBuilder<Message>,
): readonly HoverMarker[] {
  const { reorder, boxLeft } = markerColumns(columns, props);
  if (props.loading || props.rowHover === false || (!reorder && boxLeft < 0)) return [];
  return rows.map((row, index) => ({
    index,
    content: h.div(
      [h.Class('ff-data-table-markers')],
      [
        reorder
          ? h.span(
              [
                h.Class('ff-data-table-marker ff-data-table-marker-grip'),
                h.DataAttribute('shown', String(row.depth === 0)),
              ],
              [icon('grip-vertical', props.icons, h)],
            )
          : null,
        boxLeft >= 0
          ? h.span(
              [
                h.Class('ff-data-table-marker ff-data-table-marker-check'),
                h.Style({ left: `${boxLeft}px` }),
                h.DataAttribute(
                  'shown',
                  String(row.getCanSelect() && !row.getIsSelected() && !row.getIsSomeSelected()),
                ),
              ],
              [h.span([h.Class('ff-data-table-marker-box')], [])],
            )
          : null,
      ],
    ),
  }));
}
