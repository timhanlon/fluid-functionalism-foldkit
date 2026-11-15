export interface Clock {
  readonly value: number;
  readonly progress: number;
  readonly waiting: boolean;
}
export interface Playback {
  readonly count: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly loop: boolean;
}
/** Ignore background-tab stalls, retain progress while paused, and request
 * a controlled change only once until the parent acknowledges a new value. */
export function tick(
  clock: Clock,
  elapsed: number,
  playback: Playback,
): { clock: Clock; next?: number } {
  if (clock.waiting || playback.paused || elapsed < 0 || elapsed >= 100 || playback.count < 1)
    return { clock };
  const progress = Math.min(1, clock.progress + elapsed / Math.max(1, playback.duration));
  if (progress < 1 || (!playback.loop && clock.value >= playback.count - 1))
    return { clock: { ...clock, progress } };
  return {
    clock: { ...clock, progress: 1, waiting: true },
    next: (clock.value + 1) % playback.count,
  };
}
export const fillTransform = (progress: number) =>
  `translateX(calc(${Math.min(1, Math.max(0, progress)) - 1} * (100% - 6px)))`;
