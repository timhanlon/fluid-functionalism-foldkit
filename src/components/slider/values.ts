/** Fluid resolves equal distances toward the earlier (lower) list entry. */
export function nearestIndex(value: number, steps: readonly number[]): number {
  let index = 0;
  for (let i = 1; i < steps.length; i++)
    if (Math.abs(steps[i]! - value) < Math.abs(steps[index]! - value)) index = i;
  return index;
}
export function normalizedSteps(steps: readonly number[] = []): readonly number[] {
  const sorted = [...new Set(steps)].sort((a, b) => a - b);
  return sorted.length > 1 ? sorted : [];
}
export function pointerIndex(value: number, steps: readonly number[]): number {
  const min = steps[0]!,
    max = steps.at(-1)!;
  return nearestIndex(min + (value / (steps.length - 1)) * (max - min), steps);
}
