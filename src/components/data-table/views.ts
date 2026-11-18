import { Schema } from 'effect';
import type { Model } from './state';
/** A saved view contains presentation/query state, independently of data,
 * selection, pagination and the lifetimes of open controls. */
export const ViewState = Schema.Struct({
  sorting: Schema.Array(Schema.Struct({ id: Schema.String, desc: Schema.Boolean })),
  columnFilters: Schema.Array(Schema.Struct({ id: Schema.String, value: Schema.Unknown })),
  columnVisibility: Schema.Record(Schema.String, Schema.Boolean),
  columnOrder: Schema.Array(Schema.String),
  globalFilter: Schema.Unknown,
  columnLines: Schema.Record(Schema.String, Schema.Literals([1, 2, 'wrap'])),
});
export type ViewState = typeof ViewState.Type;
export const captureView = (model: Model): ViewState => ({
  sorting: model.table.sorting,
  columnFilters: model.table.columnFilters,
  columnVisibility: model.table.columnVisibility,
  columnOrder: model.table.columnOrder,
  globalFilter: model.table.globalFilter ?? '',
  columnLines: model.columnLines,
});
export function restoreView(model: Model, view: ViewState): Model {
  return {
    ...model,
    heldOrder: null,
    columnLines: view.columnLines,
    table: {
      ...model.table,
      sorting: view.sorting.map((sort) => ({ ...sort })),
      columnFilters: view.columnFilters.map((filter) => ({ ...filter })),
      columnVisibility: { ...view.columnVisibility },
      columnOrder: [...view.columnOrder],
      globalFilter: view.globalFilter,
      pagination: { ...model.table.pagination, pageIndex: 0 },
    },
  };
}
