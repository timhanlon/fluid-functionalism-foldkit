// Date entry grammar from pinned Fluid Functionalism date-picker-core.tsx.
import type { DateRange } from '../calendar';

/** Month names to month index, long and short, in the locale and in
 *  English (a typed "nov" works whatever the locale). */
function monthNames(locale?: string): Map<string, number> {
  const names = new Map<string, number>();
  for (const loc of [locale, 'en']) {
    for (const month of ['long', 'short'] as const) {
      const fmt = new Intl.DateTimeFormat(loc, { month });
      for (let m = 0; m < 12; m++) {
        const name = fmt
          .format(new Date(2000, m, 1))
          .toLowerCase()
          .replace(/\.$/, '');
        if (!names.has(name)) names.set(name, m);
      }
    }
  }
  return names;
}

/** Whether the locale writes the month before the day in numeric dates. */
function monthFirst(locale?: string) {
  const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(2000, 10, 22));
  return parts.findIndex((p) => p.type === 'month') < parts.findIndex((p) => p.type === 'day');
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day);
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null;
}

/** One typed day: "today", "yesterday", "tomorrow", "2026-11-04", "11/4",
 *  "4/11/26" (the locale's order), "Nov 4", "4 November 2026", the label's
 *  own "Wed Nov 4". No year means this year. Null when it isn't a day. */
function parseDay(text: string, locale: string | undefined, now: Date): Date | null {
  const t = text.trim().toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ');
  if (!t) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (t === 'today') return today;
  if (t === 'yesterday')
    return new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (t === 'tomorrow') return new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const year = m[3]
      ? m[3]?.length === 2
        ? 2000 + Number(m[3])
        : Number(m[3])
      : now.getFullYear();
    return monthFirst(locale) ? validDate(year, a - 1, b) : validDate(year, b - 1, a);
  }
  // Words: a month name (or its first 3+ letters), a day, maybe a year; a
  // weekday name is skipped.
  const names = monthNames(locale);
  let month = -1;
  let day = -1;
  let year = now.getFullYear();
  for (const raw of t.split(' ')) {
    const word = raw.replace(/\.$/, '').replace(/^(\d+)(st|nd|rd|th)$/, '$1');
    if (/^\d{4}$/.test(word)) year = +word;
    else if (/^\d{1,2}$/.test(word)) day = +word;
    else if (month < 0 && word.length >= 3) {
      for (const [name, index] of names) {
        if (name.startsWith(word)) {
          month = index;
          break;
        }
      }
    }
  }
  return month >= 0 && day > 0 ? validDate(year, month, day) : null;
}

/**
 * A typed date or range, for a DatePicker with `typeable`. Range mode reads
 * two days joined by "→", "to", or a spaced dash ("Nov 4 - Nov 11"), in
 * either order, and one day as a one-day range. Null when it doesn't parse.
 */
export function parseDateInput(
  text: string,
  mode: 'single' | 'range',
  locale?: string,
  now = new Date(),
): Date | DateRange | null {
  if (mode === 'single') return parseDay(text, locale, now);
  const sides = text.split(/\s*(?:→|->|–|—|\bto\b|\s-\s)\s*/i).filter((side) => side.trim() !== '');
  if (sides.length === 1) {
    const day = parseDay(sides[0]!, locale, now);
    return day ? { from: day, to: day } : null;
  }
  if (sides.length !== 2) return null;
  const a = parseDay(sides[0]!, locale, now);
  const b = parseDay(sides[1]!, locale, now);
  if (!a || !b) return null;
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}
