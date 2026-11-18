/** The source's bounded row history, expressed as immutable data. The caller
 * supplies observation time so reducer replay does not consult a clock. */
export interface Step<T> {
  readonly label: string;
  readonly before: readonly T[];
  readonly after: readonly T[];
  readonly at: number;
  readonly mergeKey?: string;
}
export interface History<T> {
  readonly rows: readonly T[];
  readonly past: readonly Step<T>[];
  readonly future: readonly Step<T>[];
  readonly dropped: number;
}
export const init = <T>(rows: readonly T[]): History<T> => ({
  rows,
  past: [],
  future: [],
  dropped: 0,
});
export const stepCount = <T>(history: History<T>) => history.dropped + history.past.length;
export function apply<T>(
  history: History<T>,
  rows: readonly T[],
  options: {
    readonly label: string;
    readonly at: number;
    readonly mergeKey?: string;
    readonly limit?: number;
  },
): History<T> {
  if (rows === history.rows) return history;
  const last = history.past.at(-1);
  const merge =
    options.mergeKey && last?.mergeKey === options.mergeKey && options.at - last.at < 1000;
  const step = merge
    ? { ...last!, after: rows, at: options.at }
    : {
        label: options.label,
        before: history.rows,
        after: rows,
        at: options.at,
        mergeKey: options.mergeKey,
      };
  const past = [...(merge ? history.past.slice(0, -1) : history.past), step];
  const over = Math.max(0, past.length - Math.max(0, options.limit ?? 100));
  return { rows, past: past.slice(over), future: [], dropped: history.dropped + over };
}
export function undoTo<T>(history: History<T>, count: number): History<T> {
  const at = Math.max(0, count - history.dropped);
  if (at >= history.past.length) return history;
  const undone = history.past.slice(at);
  return {
    ...history,
    rows: undone[0]!.before,
    past: history.past.slice(0, at),
    future: [...undone, ...history.future],
  };
}
export const undo = <T>(history: History<T>): History<T> => undoTo(history, stepCount(history) - 1);
export function redo<T>(history: History<T>): History<T> {
  const step = history.future[0];
  return step
    ? {
        ...history,
        rows: step.after,
        past: [...history.past, step],
        future: history.future.slice(1),
      }
    : history;
}
