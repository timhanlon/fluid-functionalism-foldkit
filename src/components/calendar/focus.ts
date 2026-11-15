import {
  addDays,
  addMonths,
  addYears,
  compare,
  firstOfMonth,
  lastOfMonth,
  startOfWeek,
  type Day,
} from './dates';
import { firstWeekday, type WeekOptions } from './grid';
import { dayState, type DayRules } from './matchers';
import { selectedDay, type Selection } from './selection';
export interface FocusOptions extends DayRules, WeekOptions {
  readonly shift?: boolean;
  readonly dir?: 'ltr' | 'rtl';
  readonly startMonth?: Day;
  readonly endMonth?: Day;
}
export const gridKeys = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
] as const;
/** DayPicker moves by the same unit on every skipped disabled/hidden date,
 * with a 366-attempt cap. Enter/Space stay native button activations. */
export function nextFocus(current: Day, key: string, options: FocusOptions = {}): Day | undefined {
  const horizontal = key === 'ArrowLeft' || key === 'ArrowRight',
    positive = key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown' || key === 'End';
  if (!gridKeys.some((value) => value === key)) return;
  const direction = horizontal && options.dir === 'rtl' ? (positive ? -1 : 1) : positive ? 1 : -1;
  const move = (date: Day) => {
    if (key === 'Home') return startOfWeek(date, firstWeekday(options));
    if (key === 'End') return addDays(startOfWeek(date, firstWeekday(options)), 6);
    if (key === 'ArrowLeft' || key === 'ArrowRight')
      return options.shift ? addMonths(date, direction) : addDays(date, direction);
    if (key === 'ArrowUp' || key === 'ArrowDown')
      return options.shift ? addYears(date, direction) : addDays(date, direction * 7);
    return options.shift ? addYears(date, direction) : addMonths(date, direction);
  };
  let date = current;
  for (let attempt = 0; attempt <= 365; attempt++) {
    date = move(date);
    if (direction < 0 && options.startMonth && compare(date, firstOfMonth(options.startMonth)) < 0)
      date = firstOfMonth(options.startMonth);
    if (direction > 0 && options.endMonth && compare(date, lastOfMonth(options.endMonth)) > 0)
      date = lastOfMonth(options.endMonth);
    const state = dayState(date, options);
    if (!state.disabled && !state.hidden) return date;
  }
}
/** Within visible in-month days: last focus, first selected day, today, then
 * first available day. Outside days never become the initial tab stop. */
export function initialFocus(
  days: readonly Day[],
  selection: Selection,
  today: Day,
  rules: DayRules = {},
  lastFocused?: Day,
): Day | undefined {
  const enabled = days.filter((date) => {
    const state = dayState(date, rules);
    return !state.disabled && !state.hidden;
  });
  return (
    (lastFocused && enabled.find((date) => compare(date, lastFocused) === 0)) ||
    enabled.find((date) => selectedDay(selection, date)) ||
    enabled.find((date) => compare(date, today) === 0) ||
    enabled[0]
  );
}
