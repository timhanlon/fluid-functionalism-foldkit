import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
export const Mounted = Mount.define('Checkbox.ControlKeys', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLButtonElement)) return () => {};
        const onKey = (event: KeyboardEvent) => {
          if (event.key !== 'Enter') return;
          // A native button would activate on Enter. Checkboxes reserve that
          // activation for choice cards; Space remains owned by the primitive.
          event.preventDefault();
          if (event.repeat) return;
          const card = element.closest('[data-slot=field-label]');
          if (card?.querySelector(':scope > [data-slot=field]')) element.click();
        };
        element.addEventListener('keydown', onKey);
        return () => element.removeEventListener('keydown', onKey);
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
