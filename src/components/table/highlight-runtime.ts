import type { HoverEngine } from '../../fluid-hover/engine';

/** A row can claim the visual after an owner has moved it, including when
 * focus remains on the same native control and no focus event fires. */
export const TABLE_HIGHLIGHT_EVENT = 'fluid-table-highlight';

/** Arbitrate visual ownership only. Native controls and Foldkit UI still own
 * focus, keyboard navigation, scrolling and row reordering. */
export function mountRowHighlight(root: HTMLElement, hover: HoverEngine) {
  const owner = root.ownerDocument.defaultView!;
  let keyboardOwns = false,
    repeating = false;
  let pointer: { x: number; y: number } | undefined;
  // A consumer's active SDK drag can cover the table with a pointer shield.
  // Retain its last painted row until that shield is released.
  const held = () => root.dataset.holdRowHighlight === 'true';
  const rowAt = (target: EventTarget | null) => {
    const row =
      target instanceof Element
        ? target.closest<HTMLElement>('.ff-table-row[data-fluid-hover-index]')
        : null;
    return row?.closest('.ff-table') === root ? row : undefined;
  };
  const claim = (target: EventTarget | null) => {
    const row = rowAt(target);
    if (!row || root.dataset.hover === 'off' || held()) return;
    keyboardOwns = true;
    hover.measure();
    hover.highlight(hover.items.indexOf(row));
  };
  const fromPointer = (event: PointerEvent) => {
    const moved = !pointer || pointer.x !== event.clientX || pointer.y !== event.clientY;
    pointer = { x: event.clientX, y: event.clientY };
    if (keyboardOwns && !moved) return false;
    keyboardOwns = false;
    return true;
  };
  const move = (event: PointerEvent) => {
    if (held()) {
      pointer = { x: event.clientX, y: event.clientY };
      return;
    }
    if (event.pointerType === 'touch' || !fromPointer(event)) return;
    hover.move(event.clientX, event.clientY, event.target);
  };
  const leave = (event: PointerEvent) => {
    if (held()) {
      pointer = { x: event.clientX, y: event.clientY };
      return;
    }
    if (fromPointer(event)) hover.leave();
  };
  const focus = (event: FocusEvent) => {
    if (event.target instanceof Element && event.target.matches(':focus-visible'))
      claim(event.target);
  };
  const blur = (event: FocusEvent) => {
    if (held()) return;
    if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    repeating = false;
    if (!root.matches(':hover')) {
      keyboardOwns = false;
      hover.leave();
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.repeat && event.key.startsWith('Arrow')) repeating = true;
  };
  const keyup = () => {
    repeating = false;
  };
  const requested = (event: Event) => claim(event.target);
  const pointerTarget = () => {
    if (!pointer || !root.isConnected) return null;
    const surface = root.getRootNode() as Document | ShadowRoot;
    return surface.elementFromPoint(pointer.x, pointer.y);
  };
  const trackHeldPointer = (event: PointerEvent) => {
    if (held() && event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY };
  };
  const scrolled = () => {
    if (held() || keyboardOwns || !pointer || !root.isConnected) return;
    const target = pointerTarget();
    if (target && root.contains(target)) hover.move(pointer.x, pointer.y, target);
    else hover.leave();
  };
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', blur);
  root.addEventListener('keydown', keydown);
  root.addEventListener('keyup', keyup);
  root.addEventListener(TABLE_HIGHLIGHT_EVENT, requested);
  owner.addEventListener('scroll', scrolled, { capture: true, passive: true });
  owner.addEventListener('pointermove', trackHeldPointer, { capture: true, passive: true });
  return {
    releaseHeldSlot(slot: number | null) {
      const target = pointerTarget();
      hover.measure();
      hover.highlight(target && root.contains(target) ? slot : null);
    },
    get isRepeating() {
      return repeating;
    },
    dispose() {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('focusout', blur);
      root.removeEventListener('keydown', keydown);
      root.removeEventListener('keyup', keyup);
      root.removeEventListener(TABLE_HIGHLIGHT_EVENT, requested);
      owner.removeEventListener('scroll', scrolled, { capture: true });
      owner.removeEventListener('pointermove', trackHeldPointer, { capture: true });
    },
  };
}
