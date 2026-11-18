import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';
import { animate, type AnimationPlaybackControls } from 'motion';
export const TriggerMounted = defineSilentMount('ThinkingSteps.TriggerMotion', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root = element,
          button = root.querySelector('button'),
          background = root.querySelector<HTMLElement>('.ff-thinking-trigger-highlight'),
          chevron = root.querySelector<HTMLElement>('.ff-thinking-chevron');
        if (!button || !background || !chevron) return () => {};
        const reduce = matchMedia('(prefers-reduced-motion:reduce)');
        let open = button.dataset.open === 'true',
          angle = open ? 90 : 0,
          opacity = 0;
        let rotation: AnimationPlaybackControls | undefined,
          hover: AnimationPlaybackControls | undefined;
        const paint = () => {
          chevron.style.transform = `rotate(${angle}deg)`;
        };
        paint();
        const sync = () => {
          const next = button.dataset.open === 'true';
          if (next === open) return;
          open = next;
          rotation?.stop();
          const target = open ? 90 : 0;
          if (reduce.matches) {
            angle = target;
            paint();
          } else
            rotation = animate(angle, target, {
              type: 'spring',
              duration: 0.08,
              bounce: 0,
              onUpdate: (value) => {
                angle = value;
                paint();
              },
            });
        };
        const fade = (visible: boolean) => {
          hover?.stop();
          hover = animate(opacity, visible ? 1 : 0, {
            duration: visible ? 0.08 : 0.06,
            ease: 'easeOut',
            onUpdate: (value) => {
              opacity = value;
              background.style.opacity = String(value);
            },
          });
        };
        const enter = () => fade(true),
          leave = () => fade(false);
        const reduced = () => {
          if (reduce.matches) {
            rotation?.stop();
            angle = open ? 90 : 0;
            paint();
          }
        };
        const observer = new MutationObserver(sync);
        observer.observe(button, { attributes: true, attributeFilter: ['data-open'] });
        root.addEventListener('mouseenter', enter);
        root.addEventListener('mouseleave', leave);
        reduce.addEventListener('change', reduced);
        return () => {
          observer.disconnect();
          rotation?.stop();
          hover?.stop();
          root.removeEventListener('mouseenter', enter);
          root.removeEventListener('mouseleave', leave);
          reduce.removeEventListener('change', reduced);
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
