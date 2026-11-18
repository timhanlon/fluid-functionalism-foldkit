import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';

export const SelectDraft = defineSilentMount('Slider.SelectDraft', {
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
