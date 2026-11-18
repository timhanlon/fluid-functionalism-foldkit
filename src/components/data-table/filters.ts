import type { Column, Table } from '@tanstack/table-core';
import type { FilterKind, FilterValue, SelectOption } from './types';
import { dayOf, metaOf } from './engine';
import { toNative, type Day } from '../calendar';
import type { Preset } from '../date-picker';

export function dateFilterPresets(day: Day): readonly Preset[] {
  const today = toNative(day);
  const { year, month, day: date } = day;
  const local = (monthIndex: number, dayOfMonth: number) => new Date(year, monthIndex, dayOfMonth);
  const monthIndex = month - 1;
  return [
    { label: 'Today', range: { from: today, to: today } },
    { label: 'Last 7 days', range: { from: local(monthIndex, date - 6), to: today } },
    { label: 'Last 30 days', range: { from: local(monthIndex, date - 29), to: today } },
    { label: 'This month', range: { from: local(monthIndex, 1), to: today } },
    { label: 'Last 3 months', range: { from: local(monthIndex - 3, date), to: today } },
    { label: 'This year', range: { from: local(0, 1), to: today } },
  ];
}
export const textOps = [
  'is',
  'is not',
  'contains',
  'does not contain',
  'starts with',
  'ends with',
  'is empty',
  'is not empty',
] as const;
export const optionOf = (option: SelectOption) =>
  typeof option === 'string'
    ? { value: option, label: option }
    : { ...option, label: option.label ?? option.value };
export function filterOf<T>(table: Table<T>, column: Column<T>): FilterKind | undefined {
  if (!column.accessorFn) return undefined;
  const meta = metaOf(column);
  if (meta.filter === false) return undefined;
  if (meta.filter) return meta.filter;
  const editor = meta.editor;
  if (editor) {
    const type = typeof editor === 'string' ? editor : editor.type;
    if (type === 'select' && typeof editor === 'object' && editor.type === 'select')
      return { type: 'options', options: editor.options };
    if (type === 'tags' && typeof editor === 'object' && editor.type === 'tags' && editor.options)
      return { type: 'options', options: editor.options };
    if (type === 'number' || type === 'date') return type;
  }
  const values = table
    .getCoreRowModel()
    .flatRows.map((row) => row.getValue(column.id))
    .filter((v) => v != null && v !== '');
  if (values.length && values.every((v) => typeof v === 'number')) return 'number';
  if (values.length && values.every((v) => dayOf(v))) return 'date';
  const unique = [
    ...new Set(values.flatMap((v) => (Array.isArray(v) ? v.map(String) : [String(v)]))),
  ];
  if (unique.length && unique.length <= 12 && unique.length < values.length)
    return { type: 'options', options: unique };
  return 'text';
}
export function emptyFilter(kind: FilterKind): FilterValue {
  return typeof kind === 'object'
    ? { kind: 'options', values: [] }
    : kind === 'text'
      ? { kind: 'text', query: '' }
      : { kind };
}
