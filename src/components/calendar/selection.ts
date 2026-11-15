import { Option, Schema } from 'effect';
import { Day, compare, fromNative, isEqual, toNative, type Day as CalendarDay } from './dates';
import {
  dayState,
  rangeContains,
  resolveDayMatchers,
  type DayRules,
  type DateRange,
} from './matchers';
export const Selection = Schema.TaggedUnion({
  None: {},
  Single: { date: Day },
  Range: { from: Schema.Option(Day), to: Schema.Option(Day) },
});
export type Selection = typeof Selection.Type;
export const none = (): Selection => ({ _tag: 'None' });
export const single = (date: CalendarDay): Selection => ({ _tag: 'Single', date });
export const range = (from: CalendarDay | undefined, to?: CalendarDay): Selection => ({
  _tag: 'Range',
  from: Option.fromUndefinedOr(from),
  to: Option.fromUndefinedOr(to),
});
export function fromSelected(value: Date | DateRange | undefined): Selection {
  return value instanceof Date
    ? single(fromNative(value))
    : value
      ? range(
          value.from ? fromNative(value.from) : undefined,
          value.to ? fromNative(value.to) : undefined,
        )
      : none();
}
export function toSelected(value: Selection): Date | DateRange | undefined {
  return value._tag === 'None'
    ? undefined
    : value._tag === 'Single'
      ? toNative(value.date)
      : {
          from: Option.isSome(value.from) ? toNative(value.from.value) : undefined,
          to: Option.isSome(value.to) ? toNative(value.to.value) : undefined,
        };
}
export const picking = (value: Selection): boolean =>
  value._tag === 'Range' && Option.isSome(value.from) && Option.isNone(value.to);
export const SelectionState = Schema.Struct({ selection: Selection, beforePick: Selection });
export interface SelectionState extends Schema.Schema.Type<typeof SelectionState> {}
export const initSelection = (selection: Selection = none()): SelectionState => ({
  selection,
  beforePick: none(),
});
export interface SelectionOptions extends DayRules {
  readonly mode?: 'single' | 'range';
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
}
/** Calendar always uses DayPicker's resetOnSelect and excludeDisabled rules. */
export function selectDay(
  state: SelectionState,
  date: CalendarDay,
  options: SelectionOptions = {},
): SelectionState {
  if (dayState(date, options).disabled || dayState(date, options).hidden) return state;
  if (options.mode !== 'range')
    return {
      ...state,
      selection:
        state.selection._tag === 'Single' &&
        isEqual(state.selection.date, date) &&
        !options.required
          ? none()
          : single(date),
    };
  const current = state.selection;
  const from = current._tag === 'Range' ? Option.getOrUndefined(current.from) : undefined,
    to = current._tag === 'Range' ? Option.getOrUndefined(current.to) : undefined;
  const min = options.min ?? 0,
    max = options.max ?? 0;
  let next: Selection;
  if (!from || to) {
    next =
      from && to && isEqual(from, to) && isEqual(date, from) && !options.required
        ? none()
        : range(date);
  } else if (isEqual(from, date))
    next = min === 0 ? range(from, date) : options.required ? range(from) : none();
  else next = compare(date, from) < 0 ? range(date, from) : range(from, date);
  if (next._tag === 'Range' && Option.isSome(next.from) && Option.isSome(next.to)) {
    const nights = compare(next.to.value, next.from.value),
      disabled = resolveDayMatchers(options).disabled;
    if (
      (max > 0 && nights > max) ||
      (min > 1 && nights < min) ||
      rangeContains(next.from.value, next.to.value, disabled)
    )
      next = range(date);
  }
  return {
    selection: next,
    beforePick: picking(next) && !picking(current) ? current : state.beforePick,
  };
}
export const cancelSelection = (state: SelectionState): SelectionState =>
  picking(state.selection) ? { ...state, selection: state.beforePick } : state;
export function selectedDay(value: Selection, date: CalendarDay): boolean {
  if (value._tag === 'Single') return isEqual(value.date, date);
  if (value._tag !== 'Range') return false;
  const from = Option.getOrUndefined(value.from),
    to = Option.getOrUndefined(value.to);
  if (from && to) {
    const a = compare(from, to) < 0 ? from : to,
      b = a === from ? to : from;
    return compare(date, a) >= 0 && compare(date, b) <= 0;
  }
  const anchor = from ?? to;
  return !!anchor && isEqual(anchor, date);
}
export function rangeBand(
  selection: Selection,
  preview: CalendarDay | undefined,
  options: SelectionOptions = {},
) {
  if (options.mode !== 'range' || selection._tag !== 'Range' || Option.isNone(selection.from))
    return;
  const from = selection.from.value;
  if (Option.isSome(selection.to)) return { from, to: selection.to.value };
  if (!preview) return;
  const a = compare(from, preview) < 0 ? from : preview,
    b = a === from ? preview : from;
  return rangeContains(a, b, resolveDayMatchers(options).disabled) ? undefined : { from: a, to: b };
}
