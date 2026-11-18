import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';

/** Preserve Fluid's motion value across visits and follow-axis changes.
 * Only a force-open/axis effect resets it; leaving the trigger does not.
 * The trigger Effect owns these listeners alongside its press lifecycle. */
export function trackCursor(element: Element): () => void {
  const document = element.ownerDocument;
  const Observer = document.defaultView!.MutationObserver;
  let offset = 0;
  let axis: string | null = null;
  let forced = false;
  const apply = () => {
    const panel = document.getElementById(element.getAttribute('data-tooltip-follow-panel') ?? '');
    if (panel)
      panel.style.translate = axis === 'x' ? `${offset}px 0` : axis === 'y' ? `0 ${offset}px` : '';
  };
  const appear = new Observer(apply);
  const sync = () => {
    const nextAxis = element.getAttribute('data-tooltip-follow-axis');
    const nextForced = element.getAttribute('data-tooltip-follow-forced') === 'true';
    if (nextForced && nextAxis !== 'none' && (nextForced !== forced || nextAxis !== axis))
      offset = 0;
    axis = nextAxis;
    forced = nextForced;
    appear.disconnect();
    if (axis === 'x' || axis === 'y')
      appear.observe(document.body, { childList: true, subtree: true });
    apply();
  };
  const move = (event: PointerEvent) => {
    if (axis !== 'x' && axis !== 'y') return;
    const trigger = element.firstElementChild;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    offset =
      axis === 'x'
        ? event.clientX - (box.left + box.width / 2)
        : event.clientY - (box.top + box.height / 2);
    apply();
  };
  const props = new Observer(sync);
  props.observe(element, {
    attributes: true,
    attributeFilter: ['data-tooltip-follow-axis', 'data-tooltip-follow-forced'],
  });
  sync();
  element.addEventListener('pointermove', move as EventListener);
  return () => {
    appear.disconnect();
    props.disconnect();
    element.removeEventListener('pointermove', move as EventListener);
  };
}

/** Visual translation only; trigger interactions belong to Tooltip.view. */
export const CursorFollow = defineSilentMount('Tooltip.CursorFollow', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => trackCursor(element)),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
