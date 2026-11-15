import {
  addDays,
  day,
  compare,
  firstOfMonth,
  lastOfMonth,
  ordinal,
  startOfWeek,
  type Day,
} from './dates';
export interface WeekOptions {
  readonly showWeekNumber?: boolean;
  readonly weekStartsOn?: number;
  readonly ISOWeek?: boolean;
  readonly firstWeekContainsDate?: number;
  readonly fixedWeeks?: boolean;
}
export function resolveWeekNumbering(
  showWeekNumber: boolean | undefined,
  weekStartsOn: number | undefined,
  ISOWeek: boolean | undefined,
): boolean {
  return ISOWeek ?? (!!showWeekNumber && (weekStartsOn === undefined || weekStartsOn === 1));
}
export const firstWeekday = (options: WeekOptions): number =>
  resolveWeekNumbering(options.showWeekNumber, options.weekStartsOn, options.ISOWeek)
    ? 1
    : (options.weekStartsOn ?? 0);
export function weekNumber(date: Day, options: WeekOptions = {}): { year: number; week: number } {
  const iso = resolveWeekNumbering(options.showWeekNumber, options.weekStartsOn, options.ISOWeek),
    starts = firstWeekday(options),
    contains = iso ? 4 : (options.firstWeekContainsDate ?? 1);
  const first = (year: number) => startOfWeek(day(year, 1, contains), starts);
  const year =
    compare(date, first(date.year)) < 0
      ? date.year - 1
      : compare(date, first(date.year + 1)) >= 0
        ? date.year + 1
        : date.year;
  return { year, week: Math.floor((ordinal(date) - ordinal(first(year))) / 7) + 1 };
}
export interface MonthGrid {
  readonly month: Day;
  readonly first: Day;
  readonly last: Day;
  readonly weeks: readonly {
    readonly days: readonly Day[];
    readonly week: number;
    readonly weekYear: number;
  }[];
}
export function monthGrid(date: Day, options: WeekOptions = {}): MonthGrid {
  const month = firstOfMonth(date),
    first = startOfWeek(month, firstWeekday(options)),
    last = lastOfMonth(month),
    natural = Math.ceil((ordinal(last) - ordinal(first) + 1) / 7),
    count = options.fixedWeeks ? 6 : natural;
  const weeks = Array.from({ length: count }, (_, index) => {
    const start = addDays(first, index * 7),
      number = weekNumber(start, options);
    return {
      days: Array.from({ length: 7 }, (_, offset) => addDays(start, offset)),
      week: number.week,
      weekYear: number.year,
    };
  });
  return { month, first, last: addDays(first, count * 7 - 1), weeks };
}
export interface Band {
  readonly from: Day;
  readonly to: Day;
}
/** The band owns only half an endpoint cell. Tiny row/month-break corners
 * remain square wherever a slice from the neighboring row touches them. */
export function bandSlice(
  date: Day,
  grid: MonthGrid,
  band: Band | undefined,
  outsideHidden: boolean,
  hidden = false,
) {
  const n = ordinal(date),
    from = band && ordinal(band.from),
    to = band && ordinal(band.to),
    outside = date.month !== grid.month.month || date.year !== grid.month.year;
  if (
    !band ||
    from === undefined ||
    to === undefined ||
    hidden ||
    (outsideHidden && outside) ||
    from === to ||
    n < from ||
    n > to
  )
    return;
  const column = (((n - ordinal(grid.first)) % 7) + 7) % 7;
  const drawn = (value: number) => {
    if (value < ordinal(grid.first) || value > ordinal(grid.last)) return false;
    if (!outsideHidden) return true;
    const d = addDays(date, value - n);
    return d.month === grid.month.month && d.year === grid.month.year;
  };
  const edgeLeft = n > from && (column === 0 || (date.day === 1 && outsideHidden));
  const edgeRight =
    n < to && (column === 6 || (addDays(date, 1).month !== date.month && outsideHidden));
  const atLeft = (value: number) => drawn(value) && value > from && value <= to;
  const atRight = (value: number) => drawn(value) && value >= from && value < to;
  return {
    left: n > from ? '0' : '50%',
    right: n < to ? '0' : '50%',
    borderTopLeftRadius: edgeLeft && !atLeft(n - 7) ? 2 : 0,
    borderBottomLeftRadius: edgeLeft && !atLeft(n + 7) ? 2 : 0,
    borderTopRightRadius: edgeRight && !atRight(n - 7) ? 2 : 0,
    borderBottomRightRadius: edgeRight && !atRight(n + 7) ? 2 : 0,
  };
}
