/** SDK pointer targets are insertion boundaries, including the final boundary.
 * Remove carried items before interpreting that boundary. */
export function placementAtBoundary(
  order: readonly string[],
  carried: readonly string[],
  boundary: number,
): { targetId: string; place: 'before' | 'after' } | undefined {
  const moving = new Set(carried);
  const staying = order.filter((id) => !moving.has(id));
  if (!staying.length) return;
  const index = order
    .slice(0, Math.max(0, Math.min(order.length, boundary)))
    .filter((id) => !moving.has(id)).length;
  const after = [
    ...staying.slice(0, index),
    ...order.filter((id) => moving.has(id)),
    ...staying.slice(index),
  ];
  if (after.every((id, index) => id === order[index])) return;
  return index < staying.length
    ? { targetId: staying[index]!, place: 'before' }
    : { targetId: staying[staying.length - 1]!, place: 'after' };
}
