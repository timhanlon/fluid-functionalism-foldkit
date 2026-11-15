import { Animation } from '@foldkit/ui';
import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { Message } from './state';
export const MotionConfig = Schema.Struct({
  rowDuration: Schema.Number,
  bannerDuration: Schema.Number,
  bannerDelay: Schema.Number,
  bounce: Schema.Number,
  fromScale: Schema.Number,
  dismissDuration: Schema.Number,
  shrinkTo: Schema.Number,
});
export type MotionConfig = typeof MotionConfig.Type;
export const defaultMotion: MotionConfig = {
  rowDuration: 0.32,
  bannerDuration: 0.24,
  bannerDelay: 0.08,
  bounce: 0.12,
  fromScale: 0.4,
  dismissDuration: 0.24,
  shrinkTo: 0.6,
};
const focusable =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function focusNeighbour(root: HTMLElement) {
  if (!root.contains(document.activeElement)) return;
  const candidates = [...document.querySelectorAll<HTMLElement>(focusable)].filter(
    (node) => !root.contains(node) && !node.closest('[inert]') && node.checkVisibility(),
  );
  const after = candidates.find(
    (node) => root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  const before = candidates
    .filter((node) => root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING)
    .at(-1);
  (after ?? before)?.focus({ preventScroll: true });
}
export const Mounted = Mount.defineStream('Banner.Motion', {
  args: { config: MotionConfig, fixed: Schema.Boolean },
  messages: [Message.Animation],
  execute: ({ element, config, fixed }) =>
    Stream.callback<typeof Message.Animation.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element,
            body = root.querySelector<HTMLElement>('.ff-banner-motion');
          if (!body) return () => {};
          const reduce = matchMedia('(prefers-reduced-motion:reduce)');
          const parent = root.parentElement,
            parentStyle = parent && getComputedStyle(parent);
          const gap =
            parent &&
            parent.children.length > 1 &&
            parentStyle?.display.endsWith('flex') &&
            parentStyle.flexDirection.startsWith('column')
              ? parseFloat(parentStyle.rowGap) || 0
              : 0;
          const entering = root.dataset.bannerPhase === 'EnterStart';
          let row = entering ? 0 : 1,
            shown = entering ? 0 : 1,
            scale = entering && !fixed && !reduce.matches ? config.fromScale : 1;
          let disposed = false,
            generation = -1,
            phase = '',
            motions: AnimationPlaybackControls[] = [];
          const paint = () => {
            root.style.gridTemplateRows = `${row}fr`;
            root.style.marginBottom = `${(row - 1) * gap}px`;
            root.style.overflow = fixed || phase.startsWith('Leave') ? 'hidden' : 'visible';
            body.style.opacity = String(shown);
            body.style.transform = `translateY(${fixed && !reduce.matches ? (row - 1) * 100 : 0}%) scale(${scale})`;
            body.style.pointerEvents = shown > 0.5 ? 'auto' : 'none';
          };
          const stop = () => {
            motions.forEach((motion) => motion.stop());
            motions = [];
          };
          const settle = (version: number) => {
            if (!disposed && version === generation)
              Queue.offerUnsafe(
                queue,
                Message.Animation({
                  message: Animation.Message.EndedAnimation({ generation: version }),
                }),
              );
          };
          const sync = () => {
            const nextPhase = root.dataset.bannerPhase ?? 'Idle',
              version = Number(root.dataset.bannerGeneration);
            if (nextPhase === phase && version === generation) return;
            phase = nextPhase;
            generation = version;
            if (phase === 'LeaveStart') {
              stop();
              focusNeighbour(root);
              root.inert = true;
              return;
            }
            if (phase.startsWith('Enter')) root.inert = false;
            if (phase === 'EnterStart') {
              stop();
              row = 0;
              shown = 0;
              scale = fixed || reduce.matches ? 1 : config.fromScale;
              paint();
              return;
            }
            if (!['EnterAnimating', 'LeaveAnimating'].includes(phase)) return;
            stop();
            if (phase === 'EnterAnimating') {
              if (reduce.matches) {
                row = 1;
                scale = 1;
              }
              const opening = animate(row, 1, {
                type: 'spring',
                duration: reduce.matches ? 0 : config.rowDuration,
                bounce: 0,
                onUpdate: (value) => {
                  row = value;
                  if (fixed && !reduce.matches) shown = value;
                  paint();
                },
              });
              motions.push(opening);
              if (fixed && !reduce.matches) opening.finished.then(() => settle(version));
              else {
                const appearing = animate(shown, 1, {
                  type: 'spring',
                  duration: reduce.matches ? 0.08 : config.bannerDuration,
                  bounce: reduce.matches ? 0 : config.bounce,
                  delay: reduce.matches ? 0 : config.bannerDelay,
                  onUpdate: (value) => {
                    shown = value;
                    paint();
                  },
                });
                motions.push(appearing);
                if (!reduce.matches)
                  motions.push(
                    animate(scale, 1, {
                      type: 'spring',
                      duration: config.bannerDuration,
                      bounce: config.bounce,
                      delay: config.bannerDelay,
                      onUpdate: (value) => {
                        scale = value;
                        paint();
                      },
                    }),
                  );
                Promise.all(motions.map((motion) => motion.finished)).then(() => settle(version));
              }
            } else {
              focusNeighbour(root);
              if (reduce.matches) {
                motions.push(
                  animate(shown, 0, {
                    duration: 0.06,
                    onUpdate: (value) => {
                      shown = value;
                      paint();
                    },
                  }),
                );
              } else {
                const fromRow = row,
                  fromShown = shown,
                  fromScale = scale,
                  end = fixed ? 0 : Math.min(config.shrinkTo, 0.99);
                motions.push(
                  animate(row, 0, {
                    duration: config.dismissDuration,
                    ease: 'easeInOut',
                    onUpdate: (value) => {
                      row = value;
                      const left =
                        fromRow > end
                          ? (value - end) / (fromRow - end)
                          : fromRow > 0
                            ? value / fromRow
                            : 0;
                      shown = fromShown * Math.min(1, Math.max(0, left));
                      if (!fixed) scale = Math.min(fromScale, Math.max(value, end));
                      paint();
                    },
                  }),
                );
              }
              Promise.all(motions.map((motion) => motion.finished)).then(() => settle(version));
            }
            paint();
          };
          const observer = new MutationObserver(sync);
          observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-banner-phase', 'data-banner-generation'],
          });
          paint();
          sync();
          return () => {
            disposed = true;
            observer.disconnect();
            stop();
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
