import { addDays, dayNumber, toNative, type Day } from './dates';
/** DayPicker 10's public matcher shapes; native-date predicates remain usable
 * while the calendar model itself stores date-only Foldkit values. */
export interface DateRange {
  readonly from: Date | undefined;
  readonly to?: Date;
}
export type Matcher =
  | boolean
  | Date
  | readonly Date[]
  | DateRange
  | { readonly before: Date }
  | { readonly after: Date }
  | { readonly before: Date; readonly after: Date }
  | { readonly dayOfWeek: number | readonly number[] }
  | ((date: Date) => boolean);
export type Matchers = Matcher | readonly Matcher[];
const isList = (value: Matchers): value is readonly Matcher[] => Array.isArray(value);
const isDates = (value: Matcher): value is readonly Date[] => Array.isArray(value);
const list = (matchers: Matchers | undefined): readonly Matcher[] =>
  matchers === undefined ? [] : isList(matchers) ? matchers : [matchers];
const valid = (date: Date): boolean => !Number.isNaN(date.getTime());
const inRange = (value: number, from: number, to: number) =>
  value >= Math.min(from, to) && value <= Math.max(from, to);
export function matches(date: Date, matchers: Matchers | undefined): boolean {
  const n = dayNumber(date);
  return list(matchers).some((matcher) => {
    if (typeof matcher === 'boolean') return matcher;
    if (typeof matcher === 'function') return matcher(date);
    if (matcher instanceof Date) return valid(matcher) && n === dayNumber(matcher);
    if (isDates(matcher)) return matcher.some((value) => valid(value) && n === dayNumber(value));
    if ('from' in matcher) {
      const from = matcher.from && valid(matcher.from) ? dayNumber(matcher.from) : undefined,
        to = matcher.to && valid(matcher.to) ? dayNumber(matcher.to) : undefined;
      return from !== undefined && to !== undefined ? inRange(n, from, to) : n === (from ?? to);
    }
    if ('dayOfWeek' in matcher)
      return typeof matcher.dayOfWeek === 'number'
        ? matcher.dayOfWeek === date.getDay()
        : matcher.dayOfWeek.includes(date.getDay());
    if ('before' in matcher && 'after' in matcher) {
      const before = dayNumber(matcher.before),
        after = dayNumber(matcher.after);
      return matcher.before.getTime() > matcher.after.getTime()
        ? n > after && n < before
        : n < before || n > after;
    }
    if ('before' in matcher) return n < dayNumber(matcher.before);
    if ('after' in matcher) return n > dayNumber(matcher.after);
    return false;
  });
}
export interface DayRules {
  readonly booked?: Matchers;
  readonly available?: Matchers;
  readonly disabled?: Matchers;
  readonly hidden?: Matchers;
}
export function resolveDayMatchers(rules: DayRules) {
  const outside: readonly Matcher[] =
    rules.available === undefined ? [] : [(date: Date) => !matches(date, rules.available)];
  const unavailable = [...list(rules.disabled), ...outside];
  return {
    disabled: [...list(rules.booked), ...unavailable],
    modifiers: {
      booked: rules.booked ?? false,
      unavailable: unavailable.length ? unavailable : false,
    },
  };
}
export function dayState(day: Day, rules: DayRules) {
  const date = toNative(day),
    resolved = resolveDayMatchers(rules);
  return {
    booked: matches(date, resolved.modifiers.booked),
    unavailable: matches(date, resolved.modifiers.unavailable),
    disabled: matches(date, resolved.disabled),
    hidden: matches(date, rules.hidden),
  };
}
/** Non-function matchers use endpoints/overlap; predicates are evaluated last
 * across local calendar days, matching the reference's dependency algorithm. */
export function rangeContains(from: Day, to: Day, matchers: Matchers): boolean {
  const a = dayNumber(toNative(from)),
    b = dayNumber(toNative(to)),
    all = list(matchers);
  const overlap = (start: number, end: number) => start <= end && a <= end && b >= start;
  for (const matcher of all) {
    if (typeof matcher === 'boolean' && matcher) return true;
    if (matcher instanceof Date && inRange(dayNumber(matcher), a, b)) return true;
    if (isDates(matcher) && matcher.some((date) => inRange(dayNumber(date), a, b))) return true;
    if (
      typeof matcher !== 'object' ||
      matcher === null ||
      matcher instanceof Date ||
      isDates(matcher)
    )
      continue;
    if (
      'from' in matcher &&
      matcher.from &&
      matcher.to &&
      overlap(
        Math.min(dayNumber(matcher.from), dayNumber(matcher.to)),
        Math.max(dayNumber(matcher.from), dayNumber(matcher.to)),
      )
    )
      return true;
    if ('dayOfWeek' in matcher) {
      const days = typeof matcher.dayOfWeek === 'number' ? [matcher.dayOfWeek] : matcher.dayOfWeek;
      for (let i = 0; i <= Math.min(b - a, 6); i++)
        if (days.includes(toNative(addDays(from, i)).getDay())) return true;
    }
    if (
      'before' in matcher &&
      'after' in matcher &&
      matcher.before.getTime() > matcher.after.getTime()
    ) {
      if (overlap(dayNumber(matcher.after) + 1, dayNumber(matcher.before) - 1)) return true;
    } else if (
      ('before' in matcher || 'after' in matcher) &&
      (matches(toNative(from), matcher) || matches(toNative(to), matcher))
    )
      return true;
  }
  const functions = all.filter(
    (matcher): matcher is (date: Date) => boolean => typeof matcher === 'function',
  );
  if (functions.length)
    for (let i = 0; i <= b - a; i++) {
      const date = toNative(addDays(from, i));
      if (functions.some((predicate) => predicate(date))) return true;
    }
  return false;
}
