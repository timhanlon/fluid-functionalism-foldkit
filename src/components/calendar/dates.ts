import * as Calendar from 'foldkit/calendar';
export type Day = Calendar.CalendarDate;
export const Day = Calendar.CalendarDate;
export {
  make as day,
  fromDateLocal as fromNative,
  toDateLocal as toNative,
  addDays,
  addMonths,
  addYears,
  firstOfMonth,
  lastOfMonth,
  isEqual,
} from 'foldkit/calendar';
const epoch = Calendar.make(1970, 1, 1);
/** A local calendar date's ordinal, with no time-of-day or DST arithmetic. */
export const ordinal = (day: Day): number => Calendar.daysSince(day, epoch);
export const dayNumber = (date: Date): number =>
  Number.isNaN(date.getTime()) ? NaN : ordinal(Calendar.fromDateLocal(date));
export const compare = (left: Day, right: Day): number => ordinal(left) - ordinal(right);
export const weekday = (day: Day): number =>
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(
    Calendar.dayOfWeek(day),
  );
export function startOfWeek(day: Day, weekStartsOn = 0): Day {
  return Calendar.addDays(day, -((weekday(day) - weekStartsOn + 7) % 7));
}
export const key = (day: Day): string =>
  `${String(day.year).padStart(4, '0')}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
