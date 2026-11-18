// Source: Fluid Functionalism f801409, registry/default/data-table.tsx.
// Keep the source's TanStack engine; only the React adapter is replaced.
import {
  createTable,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  functionalUpdate,
  type Row,
  type Table,
  type TableState,
} from '@tanstack/table-core';
import type { Options, FilterValue, SearchValue, ColumnMeta } from './types';

export const utilityColumns = new Set(['drag', 'select', 'actions']);
/** Editors can retain the displayed order while parent-owned values change. */
export function displayedRows<T>(table: Table<T>, heldOrder: readonly string[] | null): Row<T>[] {
  return heldOrder
    ? heldOrder.flatMap((id) => {
        const row = table.getCoreRowModel().rowsById[id];
        return row ? [row] : [];
      })
    : table.getRowModel().rows;
}
export const drawnColumns = <T>(table: import('@tanstack/table-core').Table<T>) => [
  ...table.getLeftVisibleLeafColumns(),
  ...table.getCenterVisibleLeafColumns(),
  ...table.getRightVisibleLeafColumns(),
];
export function drawnOrder<T>(table: import('@tanstack/table-core').Table<T>): string[] {
  const order = table.getAllLeafColumns().map((c) => c.id),
    pin = table.getState().columnPinning;
  const left = (pin.left ?? []).filter((id) => order.includes(id)),
    right = (pin.right ?? []).filter((id) => order.includes(id));
  const held = new Set([...left, ...right]);
  return [...left, ...order.filter((id) => !held.has(id)), ...right];
}
/** A freeze names places, not the old occupants of those places. Preserve
 * the count of visible frozen data columns when a header crosses the edge. */
export function setOrderKeepingFrozen<T>(
  table: import('@tanstack/table-core').Table<T>,
  order: string[],
): void {
  table.setColumnOrder(order);
  const pin = table.getState().columnPinning,
    left = pin.left ?? [];
  const byId = new Map(table.getAllLeafColumns().map((c) => [c.id, c]));
  const isData = (id: string) => byId.get(id)?.accessorFn !== undefined;
  const frozen = left.filter((id) => isData(id) && byId.get(id)?.getIsVisible()).length;
  if (!frozen) return;
  const right = new Set(pin.right ?? []);
  const first = order
    .filter(
      (id) =>
        isData(id) && !right.has(id) && byId.get(id)?.getIsVisible() && byId.get(id)?.getCanPin(),
    )
    .slice(0, frozen);
  const hidden = left.filter((id) => isData(id) && !byId.get(id)?.getIsVisible());
  table.setColumnPinning((old) => ({
    ...old,
    left: [...left.filter((id) => !isData(id)), ...first, ...hidden],
  }));
}
export function searchFn<T>(row: Row<T>, columnId: string, search: SearchValue): boolean {
  const query = (typeof search === 'string' ? search : (search?.query ?? '')).trim().toLowerCase();
  if (!query) return true;
  if (typeof search === 'object' && search.column !== columnId) return false;
  const value = row.getValue(columnId);
  return (Array.isArray(value) ? value.join(' ') : String(value ?? ''))
    .toLowerCase()
    .includes(query);
}
export function dayOf(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : undefined;
}
export function filterFn<T>(row: Row<T>, columnId: string, filter: FilterValue): boolean {
  const value = row.getValue(columnId);
  if (filter == null) return true;
  if (typeof filter === 'string' || filter.kind === 'text') {
    const op = typeof filter === 'string' ? 'contains' : (filter.op ?? 'contains');
    const text = (Array.isArray(value) ? value.join(' ') : String(value ?? ''))
      .trim()
      .toLowerCase();
    if (op === 'is empty') return text === '';
    if (op === 'is not empty') return text !== '';
    const query = (typeof filter === 'string' ? filter : filter.query).trim().toLowerCase();
    if (!query) return true;
    switch (op) {
      case 'is':
        return text === query;
      case 'is not':
        return text !== query;
      case 'does not contain':
        return !text.includes(query);
      case 'starts with':
        return text.startsWith(query);
      case 'ends with':
        return text.endsWith(query);
      default:
        return text.includes(query);
    }
  }
  if (filter.kind === 'options') {
    if (!filter.values.length) return true;
    const have = Array.isArray(value) ? value.map(String) : [String(value ?? '')];
    const any = have.some((v) => filter.values.includes(v));
    return filter.op === 'is not' ? !any : any;
  }
  if (filter.kind === 'number') {
    if (filter.min === undefined && filter.max === undefined) return true;
    if (value == null || value === '') return false;
    const n = Number(value);
    return (
      !Number.isNaN(n) &&
      (filter.min === undefined || n >= filter.min) &&
      (filter.max === undefined || n <= filter.max)
    );
  }
  const op = filter.op ?? 'between';
  const bound =
    op === 'before' ? filter.to : op === 'after' ? filter.from : filter.from || filter.to;
  if (!bound) return true;
  const day = dayOf(value);
  if (!day) return false;
  if (op === 'before') return day < filter.to!;
  if (op === 'after') return day > filter.from!;
  return (!filter.from || day >= filter.from) && (!filter.to || day <= filter.to);
}
export function columnId<T>(column: Options<T>['columns'][number]): string {
  return (
    column.id ?? ('accessorKey' in column ? String(column.accessorKey) : (column.header ?? ''))
  );
}
export const metaOf = (column: { readonly columnDef: { readonly meta?: unknown } }): ColumnMeta =>
  (column.columnDef.meta as ColumnMeta) ?? {};

/** A render/update-local engine. It never lives in the Model or mutates a prior Model. */
export function engine<T>(
  options: Options<T>,
  state?: TableState,
  onChange?: (state: TableState) => void,
) {
  const ids = options.columns.map(columnId);
  const clean = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(clean)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, v]) => v !== undefined)
              .map(([key, v]) => [key, clean(v)]),
          )
        : value;
  const snapshot = (value: TableState): TableState => ({
    ...value,
    globalFilter: value.globalFilter ?? '',
    columnFilters: value.columnFilters.map((filter) => ({ ...filter, value: clean(filter.value) })),
  });
  const normalized = state
    ? snapshot({
        ...state,
        columnPinning:
          options.enableColumnPinning === false
            ? { left: [], right: [] }
            : {
                left: (state.columnPinning.left ?? []).filter((id) => ids.includes(id)),
                right: (state.columnPinning.right ?? []).filter((id) => ids.includes(id)),
              },
      })
    : undefined;
  let current = normalized;
  const table = createTable<T>({
    data: [...options.data],
    columns: options.columns.map((column) => {
      const id = columnId(column);
      const hasAccessor =
        ('accessorKey' in column && column.accessorKey !== undefined) ||
        ('accessorFn' in column && typeof column.accessorFn === 'function');
      return {
        ...column,
        id,
        ...(options.getCellValue && hasAccessor && !utilityColumns.has(id)
          ? { accessorFn: (row: T) => options.getCellValue!(row, id) }
          : {}),
      };
    }),
    getRowId: options.getRowId,
    getSubRows: options.getSubRows,
    enableRowSelection: options.enableRowSelection,
    enableColumnPinning: options.enableColumnPinning,
    state: normalized ?? ({} as TableState),
    onStateChange: (updater) => {
      current = snapshot(functionalUpdate(updater, current ?? table.initialState));
      table.setOptions((old) => ({ ...old, state: current! }));
      onChange?.(current);
    },
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    paginateExpandedRows: false,
    filterFromLeafRows: true,
    sortDescFirst: false,
    autoResetPageIndex: false,
    columnResizeMode: 'onChange',
    getColumnCanGlobalFilter: () => true,
    defaultColumn: { filterFn, size: 166 },
    globalFilterFn: searchFn,
    initialState: {
      globalFilter: '',
      columnPinning:
        options.enableColumnPinning === false
          ? { left: [], right: [] }
          : {
              left: [
                ...['drag', 'select'].filter((id) => ids.includes(id)),
                ...ids.filter((id) => !utilityColumns.has(id)).slice(0, 1),
              ],
              right: ids.includes('actions') ? ['actions'] : [],
            },
      ...options.initialState,
      pagination: {
        pageIndex: 0,
        pageSize: options.pageSize ?? 10,
        ...options.initialState?.pagination,
      },
    },
  });
  if (!state) table.setOptions((old) => ({ ...old, state: table.initialState }));
  return table;
}
