import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
export const Entered = Mount.define('ThinkingSteps.Entrance', {
  args: { kind: Schema.Literals(['step', 'source', 'image']), delay: Schema.Number },
  messages: [Schema.Never],
  execute: ({ element, kind, delay }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root = element,
          reduce = matchMedia('(prefers-reduced-motion:reduce)');
        const motions: AnimationPlaybackControls[] = [];
        let resize: ResizeObserver | undefined,
          height = 0,
          target = -1,
          heightMotion: AnimationPlaybackControls | undefined;
        const paint = (value: number) => {
          root.style.height = `${value}px`;
          height = value;
        };
        if (kind === 'step') {
          const inner = root.firstElementChild;
          if (!(inner instanceof HTMLElement)) return () => {};
          paint(0);
          inner.style.opacity = '0';
          const measure = () => {
            const next = inner.offsetHeight;
            if (next <= 0 || next === target) return;
            target = next;
            heightMotion?.stop();
            heightMotion = animate(height, next, {
              type: 'spring',
              duration: 0.24,
              bounce: 0.12,
              onUpdate: paint,
            });
          };
          resize = new ResizeObserver(measure);
          resize.observe(inner);
          measure();
          motions.push(
            animate(inner, { opacity: [0, 1] }, { duration: 0.24, delay, ease: 'easeOut' }),
          );
        } else {
          root.style.opacity = '0';
          root.style.filter = 'blur(4px)';
          if (kind === 'source' && !reduce.matches) root.style.transform = 'scale(.85)';
          motions.push(
            animate(
              root,
              { opacity: [0, 1] },
              {
                ...(kind === 'source'
                  ? { type: 'spring' as const, duration: 0.16, bounce: 0 }
                  : { duration: 0.2, ease: 'easeOut' as const }),
                delay,
              },
            ),
          );
          motions.push(
            animate(
              root,
              { filter: ['blur(4px)', 'blur(0px)'] },
              { duration: kind === 'source' ? 0.12 : 0.15, delay },
            ),
          );
          if (kind === 'source' && !reduce.matches)
            motions.push(
              animate(
                root,
                { scale: [0.85, 1] },
                { type: 'spring', duration: 0.16, bounce: 0, delay },
              ),
            );
        }
        const reduced = () => {
          if (reduce.matches && kind === 'source') {
            motions.forEach((motion) => motion.stop());
            root.style.transform = 'none';
            root.style.opacity = '1';
            root.style.filter = 'none';
          }
        };
        reduce.addEventListener('change', reduced);
        return () => {
          resize?.disconnect();
          heightMotion?.stop();
          motions.forEach((motion) => motion.stop());
          reduce.removeEventListener('change', reduced);
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
