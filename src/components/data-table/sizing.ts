// Fluid Functionalism f801409, DataTable natural widths and proportional fitting.
import type { Table } from '@tanstack/table-core';
import { columnId, drawnColumns, metaOf } from './engine';
import type { Props } from './types';

export interface NaturalColumn {
  readonly id: string;
  readonly width: number;
  readonly floor: number;
  readonly fixed: boolean;
}
export interface SizingConfig {
  readonly key: string;
  readonly generation: number;
  readonly size: 'default' | 'compact';
  readonly loading: boolean;
  readonly resize: boolean;
  readonly seeded: boolean;
  readonly guessed: boolean;
  readonly columns: readonly {
    id: string;
    size?: number;
    cap: boolean;
    fixed: boolean;
    texts?: readonly string[];
  }[];
}
export function restColumn<T>(table: Table<T>, resize: boolean): string | undefined {
  const visible = drawnColumns(table);
  return resize
    ? [...visible].reverse().find((column) => column.getCanResize())?.id
    : (visible.find((column) => /(^|\s)w-full(\s|$)/.test(metaOf(column).className ?? ''))?.id ??
        [...visible].reverse().find((column) => column.accessorFn)?.id);
}
export function sizingConfig<T>(
  table: Table<T>,
  props: Props<T>,
  generation: number,
  guessed: boolean,
  lines: Readonly<Record<string, unknown>> = {},
): SizingConfig {
  const visible = drawnColumns(table);
  const expander = table.getCanSomeRowsExpand()
    ? visible.find((column) => column.accessorFn)?.id
    : undefined;
  const columns = visible.map((column) => ({
    id: column.id,
    size: props.columns.find((definition) => columnId(definition) === column.id)?.size,
    cap: column.getCanResize(),
    fixed: !column.getCanResize() || !!column.getIsPinned(),
    ...(column.id === expander
      ? {
          texts: table
            .getCoreRowModel()
            .flatRows.map((row) => String(row.getValue(column.id) ?? '')),
        }
      : {}),
  }));
  return {
    // Sorting, searching and editing don't make widths jump. A new row count,
    // page size, column layout, size variant or loading phase reads them again.
    key: JSON.stringify([
      props.data.length,
      table.getState().pagination.pageSize,
      props.size ?? 'default',
      !!props.loading,
      !!props.resizeColumns,
      !!expander,
      visible.map((column, index) => [
        columns[index]!.id,
        columns[index]!.size,
        columns[index]!.fixed,
        column.columnDef.header,
        {
          lines: lines[column.id] ?? metaOf(column).lines,
          icon: metaOf(column).icon,
          className: metaOf(column).className,
        },
      ]),
    ]),
    generation,
    size: props.size ?? 'default',
    loading: !!props.loading,
    resize: !!props.resizeColumns,
    seeded: Object.keys(table.getState().columnSizing).length > 0,
    guessed,
    columns,
  };
}
export function fitColumns(
  columns: readonly NaturalColumn[],
  available: number,
): Record<string, number> {
  const total = columns.reduce((sum, column) => sum + column.width, 0);
  const give = columns.reduce(
    (sum, column) => sum + (column.fixed ? 0 : Math.max(0, column.width - column.floor)),
    0,
  );
  const share = total > available && give > 0 ? Math.min(1, (total - available) / give) : 0;
  const widths = Object.fromEntries(
    columns.map((column) => [
      column.id,
      Math.round(
        column.width - (column.fixed ? 0 : Math.max(0, column.width - column.floor) * share),
      ),
    ]),
  );
  return widths;
}
