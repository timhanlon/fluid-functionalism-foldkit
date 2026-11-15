import { toNative, type Day } from './dates';
export interface DayModifiers {
  readonly selected: boolean;
  readonly today: boolean;
  readonly booked: boolean;
  readonly disabled: boolean;
  readonly outside: boolean;
  readonly hidden: boolean;
}
export interface Labels {
  readonly previousMonth?: string;
  readonly nextMonth?: string;
  readonly day?: (date: Date, modifiers: DayModifiers) => string;
  readonly month?: (date: Date) => string;
  readonly weekday?: (date: Date) => string;
  readonly weekNumber?: (week: number) => string;
  readonly weekNumberHeader?: string;
}
export interface Formatters {
  readonly caption?: (date: Date) => string;
  readonly weekday?: (date: Date) => string;
  readonly day?: (date: Date) => string;
  readonly weekNumber?: (week: number) => string;
}
function ordinalDay(day: number): string {
  return `${day}${day % 100 >= 11 && day % 100 <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'}`;
}
/** A render shares formatters across its days; no locale state survives the render. */
export function createLabelFormatters(locale = 'en-US') {
  const monthCaption = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const longWeekday = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  const shortWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const english = locale.startsWith('en');
  const dateLabel = new Intl.DateTimeFormat(
    locale,
    english ? { month: 'long' } : { dateStyle: 'full' },
  );
  const dayName = (date: Day, short = false) =>
    (short ? shortWeekday : longWeekday).format(toNative(date));
  return {
    caption: (date: Day) => monthCaption.format(toNative(date)),
    dayName,
    dayLabel: (date: Day, modifiers: DayModifiers) => {
      let label = english
        ? `${dayName(date)}, ${dateLabel.format(toNative(date))} ${ordinalDay(date.day)}, ${date.year}`
        : dateLabel.format(toNative(date));
      if (modifiers.today) label = `Today, ${label}`;
      if (modifiers.selected) label += ', selected';
      if (modifiers.booked) label += ', booked';
      return label;
    },
  };
}
