/** A static visual copy cannot register as a live row, drag target or control. */
export function copyVisual(source: HTMLElement): HTMLElement {
  const copy = source.cloneNode(true) as HTMLElement;
  for (const node of [copy, ...copy.querySelectorAll('*')])
    for (const name of [
      'id',
      'data-row-id',
      'data-fluid-hover-index',
      'data-sortable-id',
      'data-draggable-id',
      'data-fluid-hover-active',
      'data-under-highlight',
      'data-row-carried',
      'data-row-dragging',
    ])
      node.removeAttribute(name);
  copy.classList.remove('is-active');
  // Removing the live hover index must not switch body text to header weight.
  copy.style.fontVariationSettings = getComputedStyle(source).fontVariationSettings;
  copy.style.opacity = '1';
  copy.style.transform = 'none';
  copy.style.translate = 'none';
  return copy;
}
