import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { spring } from '../motion';
import { Message } from './state';

/** The source's inner Motion box; the outer anchor keeps positioning and
 * cursor-follow transforms independent from the enter/exit slide. */
export const Motion = Mount.defineStream('Tooltip.Motion', {
  messages: [Message.ExitFinished],
  execute: ({ element }) =>
    Stream.callback<typeof Message.ExitFinished.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const label = element;
          const root = label.parentElement;
          if (!root) return () => {};
          const reduce = matchMedia('(prefers-reduced-motion: reduce)');
          let animation: AnimationPlaybackControls | undefined;
          let previous: boolean | undefined;
          let generation = 0;
          const sync = () => {
            const closing = root.dataset.closing === 'true';
            if (previous === closing) return;
            const fresh = previous === undefined;
            previous = closing;
            const run = ++generation;
            const version = Number(root.dataset.tooltipVersion);
            animation?.stop();
            const side = root.dataset.side;
            const x = reduce.matches ? 0 : side === 'left' ? 4 : side === 'right' ? -4 : 0;
            const y = reduce.matches
              ? 0
              : side === 'bottom'
                ? -4
                : side === 'left' || side === 'right'
                  ? 0
                  : 4;
            if (fresh && closing) {
              label.style.opacity = '0';
              return;
            }
            animation = animate(
              label,
              {
                opacity: fresh ? [0, 1] : closing ? 0 : 1,
                // The site's registry/radix/tooltip returns to (0,0) on
                // entrance, then fades in place. Only the unused Base flavor
                // slides back toward the trigger on exit.
                x: fresh ? [x, 0] : 0,
                y: fresh ? [y, 0] : 0,
              },
              {
                ...(closing ? spring.fast.exit : spring.fast),
                onComplete: () => {
                  if (
                    closing &&
                    run === generation &&
                    root.dataset.closing === 'true' &&
                    version === Number(root.dataset.tooltipVersion)
                  )
                    Queue.offerUnsafe(queue, Message.ExitFinished({ version }));
                },
              },
            );
          };
          const observer = new MutationObserver(sync);
          observer.observe(root, { attributes: true, attributeFilter: ['data-closing'] });
          sync();
          return () => {
            observer.disconnect();
            generation++;
            animation?.stop();
          };
        }),
        (release) => Effect.sync(release),
      ),
    ),
});
