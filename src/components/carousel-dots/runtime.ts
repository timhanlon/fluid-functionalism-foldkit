import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { mountHover } from '../../fluid-hover/engine';
import { fillTransform, tick, type Clock } from './clock';
import '../../fluid-hover/styles.css';
export const Advanced = Schema.TaggedStruct('Advanced', { value: Schema.Number });
export const Mounted = Mount.defineStream('CarouselDots.Visuals', {
  messages: [Advanced],
  execute: ({ element }) =>
    Stream.callback<typeof Advanced.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element,
            reduce = matchMedia('(prefers-reduced-motion:reduce)');
          const hover = mountHover(root, {
            itemSelector: '.ff-carousel-dot',
            axis: 'x',
            nearest: false,
            keyboardNavigation: false,
            focusHighlight: false,
            followLayout: true,
            radius: () => (root.dataset.radius === 'sharp' ? '0px' : '999px'),
          });
          const widths = new Map<
            HTMLElement,
            { width: number; target: number; animation?: AnimationPlaybackControls }
          >();
          let clock: Clock = { value: Number(root.dataset.value), progress: 0, waiting: false };
          let autoplay = false,
            initialized = false,
            frame = 0,
            last = performance.now(),
            disposed = false;
          const external = () =>
            root.dataset.progress === '' ? undefined : Number(root.dataset.progress);
          const paint = () => {
            const fill = root.querySelector<HTMLElement>(
              '.ff-carousel-dot[aria-current=true] .ff-carousel-fill',
            );
            if (fill)
              fill.style.transform = fillTransform(external() ?? (autoplay ? clock.progress : 1));
          };
          const sync = () => {
            const value = Number(root.dataset.value),
              playing = root.dataset.autoplay === 'true' && external() === undefined;
            if (!initialized || value !== clock.value || playing !== autoplay)
              clock = { value, progress: playing ? 0 : 1, waiting: false };
            autoplay = playing;
            for (const dot of root.querySelectorAll<HTMLElement>('.ff-carousel-dot')) {
              const track = dot.querySelector<HTMLElement>('.ff-carousel-track');
              if (!track) continue;
              const target = dot.getAttribute('aria-current') === 'true' ? 24 : 6;
              let previous = widths.get(track);
              if (previous?.target === target && !reduce.matches) continue;
              previous?.animation?.stop();
              const entry = {
                width: previous?.width ?? target,
                target,
                animation: undefined as AnimationPlaybackControls | undefined,
              };
              widths.set(track, entry);
              if (!initialized || reduce.matches) {
                entry.width = target;
                track.style.width = `${target}px`;
              } else
                entry.animation = animate(entry.width, target, {
                  type: 'spring',
                  duration: 0.16,
                  bounce: 0,
                  onUpdate: (value) => {
                    entry.width = value;
                    track.style.width = `${value}px`;
                  },
                });
            }
            for (const [track, entry] of widths)
              if (!root.contains(track)) {
                entry.animation?.stop();
                widths.delete(track);
              }
            initialized = true;
            paint();
            if (autoplay && !reduce.matches) {
              if (!frame) {
                last = performance.now();
                frame = requestAnimationFrame(onFrame);
              }
            } else {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          };
          const onFrame = (now: number) => {
            frame = 0;
            if (disposed || !autoplay || reduce.matches) return;
            const elapsed = now - last;
            last = now;
            if (autoplay && !reduce.matches) {
              const result = tick(clock, elapsed, {
                count: Number(root.dataset.count),
                duration: Number(root.dataset.duration),
                paused: root.dataset.paused === 'true',
                loop: root.dataset.loop !== 'false',
              });
              clock = result.clock;
              paint();
              if (result.next !== undefined)
                Queue.offerUnsafe(queue, { _tag: 'Advanced', value: result.next });
            }
            frame = requestAnimationFrame(onFrame);
          };
          const observer = new MutationObserver(sync);
          observer.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [
              'data-value',
              'data-count',
              'data-duration',
              'data-paused',
              'data-loop',
              'data-autoplay',
              'data-progress',
            ],
          });
          const onReduced = () => {
            last = performance.now();
            sync();
          };
          reduce.addEventListener('change', onReduced);
          sync();
          return () => {
            disposed = true;
            cancelAnimationFrame(frame);
            observer.disconnect();
            reduce.removeEventListener('change', onReduced);
            hover.dispose();
            widths.forEach((entry) => entry.animation?.stop());
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
