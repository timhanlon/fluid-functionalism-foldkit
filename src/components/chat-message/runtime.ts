import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
/** Entrance finishes before position-only FLIP begins. Measuring subtracts the
 * current translation so an interrupted layout spring continues from where it
 * is actually painted, rather than stacking a second jump on top. */
export const Mounted = Mount.define('ChatMessage.Motion', {
  args: { entrance: Schema.Boolean },
  messages: [Schema.Never],
  execute: ({ element, entrance }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root = element,
          parent = root.parentElement,
          reduce = matchMedia('(prefers-reduced-motion:reduce)'),
          touch = matchMedia('(pointer: coarse)');
        let entered = !entrance,
          disposed = false,
          frame = 0,
          x = 0,
          y = 0;
        let enterMotion: AnimationPlaybackControls | undefined,
          layoutMotion: AnimationPlaybackControls | undefined;
        const touchMode = () => {
          root.dataset.touch = String(
            ('ontouchstart' in window || navigator.maxTouchPoints > 0) && touch.matches,
          );
        };
        touch.addEventListener('change', touchMode);
        window.addEventListener('pointerdown', touchMode);
        touchMode();
        const rect = () => {
          const box = root.getBoundingClientRect();
          const parentBox = parent?.getBoundingClientRect();
          return {
            left: box.left - x - (parentBox?.left ?? 0) + (parent?.scrollLeft ?? 0),
            top: box.top - y - (parentBox?.top ?? 0) + (parent?.scrollTop ?? 0),
          };
        };
        let previous = rect();
        const paint = () => {
          root.style.transform = `translate(${x}px,${y}px)`;
        };
        const measure = () => {
          frame = 0;
          if (!entered || disposed) return;
          const next = rect(),
            dx = previous.left - next.left,
            dy = previous.top - next.top;
          previous = next;
          if (reduce.matches || (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1)) return;
          layoutMotion?.stop();
          const fromX = x + dx,
            fromY = y + dy;
          x = fromX;
          y = fromY;
          paint();
          layoutMotion = animate(0, 1, {
            type: 'spring',
            duration: 0.16,
            bounce: 0,
            onUpdate: (value) => {
              x = fromX * (1 - value);
              y = fromY * (1 - value);
              paint();
            },
          });
        };
        const schedule = () => {
          if (!frame) frame = requestAnimationFrame(measure);
        };
        const resize = new ResizeObserver(schedule);
        resize.observe(root);
        if (parent) resize.observe(parent);
        const observer = new MutationObserver(schedule);
        if (parent)
          observer.observe(parent, { childList: true, subtree: true, characterData: true });
        const settle = () => {
          if (disposed) return;
          entered = true;
          root.style.opacity = '1';
          x = 0;
          y = 0;
          paint();
          previous = rect();
        };
        const reduceChanged = () => {
          enterMotion?.stop();
          layoutMotion?.stop();
          settle();
        };
        reduce.addEventListener('change', reduceChanged);
        if (entrance) {
          root.style.opacity = '0';
          if (!reduce.matches) root.style.transform = 'translateY(8px) scale(.96)';
          enterMotion = animate(0, 1, {
            type: 'spring',
            duration: 0.16,
            bounce: 0,
            onUpdate: (value) => {
              root.style.opacity = String(value);
              root.style.transform = reduce.matches
                ? 'none'
                : `translateY(${8 * (1 - value)}px) scale(${0.96 + 0.04 * value})`;
            },
            onComplete: settle,
          });
        }
        return () => {
          disposed = true;
          cancelAnimationFrame(frame);
          enterMotion?.stop();
          layoutMotion?.stop();
          resize.disconnect();
          observer.disconnect();
          reduce.removeEventListener('change', reduceChanged);
          touch.removeEventListener('change', touchMode);
          window.removeEventListener('pointerdown', touchMode);
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
