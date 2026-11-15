import type { Html, HtmlBuilder } from 'foldkit/html';
import { ordinal, toNative, type Day } from './dates';
import type { Message } from './state';
export type Detail =
  | string
  | number
  | false
  | null
  | undefined
  | ((h: HtmlBuilder<Message>) => Html);
export type DayDetail = (date: Date) => Detail;
const cache = new WeakMap<DayDetail, Map<number, Detail>>();
/** Memoize the pure date projection, then build fresh Html in the current
 * Foldkit view frame. A new function identity invalidates the projection. */
export function detailFor(project: DayDetail | undefined, date: Day, outside: boolean): Detail {
  if (!project || outside) return;
  let entries = cache.get(project);
  if (!entries) {
    entries = new Map();
    cache.set(project, entries);
  }
  const n = ordinal(date);
  if (!entries.has(n)) entries.set(n, project(toNative(date)));
  return entries.get(n);
}
export const hasDetail = (detail: Detail): boolean =>
  detail !== null && detail !== undefined && detail !== false && detail !== '';
