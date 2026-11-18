import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';
import { animate, type AnimationPlaybackControls } from 'motion';
/** The panel persists to keep aria-controls valid, and hides only after its
 * closing spring settles. offsetHeight stays correct under scaled ancestors. */
export const PanelMounted = defineSilentMount('ThinkingSteps.Collapse', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const panel = element,
          clip = panel.firstElementChild,
          inner = clip?.firstElementChild;
        if (!(clip instanceof HTMLElement) || !(inner instanceof HTMLElement)) return () => {};
        let initialized = false,
          open = false,
          height = 0,
          target = -1,
          generation = 0,
          motion: AnimationPlaybackControls | undefined;
        const sync = () => {
          const next = panel.dataset.open === 'true';
          if (next) panel.hidden = false;
          const nextTarget = next ? inner.offsetHeight : 0;
          if (initialized && next === open && nextTarget === target) return;
          const version = ++generation;
          motion?.stop();
          open = next;
          target = nextTarget;
          const paint = (value: number) => {
            height = value;
            clip.style.height = `${value}px`;
          };
          if (!initialized) {
            paint(target);
            panel.hidden = !open;
            initialized = true;
            return;
          }
          motion = animate(height, target, {
            type: 'spring',
            duration: 0.16,
            bounce: 0,
            onUpdate: paint,
            onComplete: () => {
              if (version === generation) panel.hidden = !open;
            },
          });
        };
        const resize = new ResizeObserver(() => {
          if (inner.offsetHeight > 0) sync();
        });
        resize.observe(inner);
        const observer = new MutationObserver(sync);
        observer.observe(panel, { attributes: true, attributeFilter: ['data-open'] });
        sync();
        return () => {
          ++generation;
          observer.disconnect();
          resize.disconnect();
          motion?.stop();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
