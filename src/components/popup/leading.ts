import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';

/** Scope the leading control's own events. Child handlers run first, while
 * the enclosing primitive retains Escape, Tab and outside-focus dismissal. */
export const Leading = defineSilentMount('Popup.Leading', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const stop = (event: Event) => event.stopPropagation();
        const popup = element.closest<HTMLElement>('[role=menu]');
        // Internal focus handoff to/from a leading control is not leaving
        // the menu, just as focusing its composed search header is internal.
        const blur = (event: FocusEvent) => {
          if (
            event.relatedTarget instanceof Node &&
            popup?.contains(event.relatedTarget) &&
            ((event.target instanceof Node && element.contains(event.target)) ||
              element.contains(event.relatedTarget))
          )
            event.stopImmediatePropagation();
        };
        const key = (event: KeyboardEvent) => {
          if (event.key !== 'Escape' && event.key !== 'Tab') event.stopPropagation();
        };
        element.addEventListener('click', stop);
        element.addEventListener('keydown', key);
        element.addEventListener('keyup', key);
        popup?.addEventListener('blur', blur, true);
        return () => {
          element.removeEventListener('click', stop);
          element.removeEventListener('keydown', key);
          element.removeEventListener('keyup', key);
          popup?.removeEventListener('blur', blur, true);
        };
      }),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
