import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';

export const SelectDraft = Mount.define('Slider.SelectDraft', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        requestAnimationFrame(() => {
          if (element instanceof HTMLInputElement) {
            element.focus();
            element.select();
          }
        }),
      ),
      (frame) => Effect.sync(() => cancelAnimationFrame(frame)),
    ).pipe(Effect.andThen(Effect.never)),
});
