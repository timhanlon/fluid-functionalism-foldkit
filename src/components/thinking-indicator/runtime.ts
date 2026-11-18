import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';
import { animate, type AnimationPlaybackControls } from 'motion';
import { circleA, circleB, infinity, words } from './data';
export const Mounted = defineSilentMount('ThinkingIndicator.Motion', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root = element,
          current = root.querySelector<HTMLElement>('.ff-thinking-current');
        if (!current) return () => {};
        const reduce = matchMedia('(prefers-reduced-motion:reduce)');
        let index = 0,
          timer: ReturnType<typeof setInterval> | undefined,
          glyph: AnimationPlaybackControls | undefined;
        const motions = new Set<AnimationPlaybackControls>();
        const leaving = new Set<HTMLElement>();
        const stopWords = () => {
          clearInterval(timer);
          timer = undefined;
          motions.forEach((motion) => motion.stop());
          motions.clear();
          leaving.forEach((node) => node.remove());
          leaving.clear();
          current.style.transform = 'none';
          current.style.opacity = '1';
        };
        const syncGlyph = () => {
          glyph?.stop();
          glyph = undefined;
          const path = root.querySelector<SVGPathElement>('.ff-thinking-glyph path');
          if (!path) return;
          path.setAttribute('d', reduce.matches ? infinity : circleA);
          if (!reduce.matches)
            glyph = animate(
              path,
              { d: [circleA, infinity, circleB, infinity, circleA] },
              { duration: 6, ease: 'easeInOut', repeat: Infinity, times: [0, 0.25, 0.5, 0.75, 1] },
            );
        };
        const cycle = () => {
          const old = current.cloneNode(true) as HTMLElement;
          old.classList.remove('ff-thinking-current');
          old.classList.add('ff-thinking-leaving');
          current.parentElement?.append(old);
          leaving.add(old);
          const exit = animate(
            old,
            { y: ['0%', '-80%'], opacity: [1, 0] },
            {
              duration: 0.16,
              ease: [0.4, 0, 0.2, 1],
              onComplete: () => {
                old.remove();
                leaving.delete(old);
                motions.delete(exit);
              },
            },
          );
          motions.add(exit);
          index = (index + 1) % words.length;
          current.textContent = words[index]!;
          const enter: AnimationPlaybackControls = animate(
            current,
            { y: ['80%', '0%'], opacity: [0, 1] },
            {
              duration: 0.24,
              ease: [0.4, 0, 0.2, 1],
              onComplete: () => {
                motions.delete(enter);
              },
            },
          );
          motions.add(enter);
        };
        const sync = () => {
          stopWords();
          syncGlyph();
          current.textContent = words[reduce.matches ? 0 : index]!;
          if (!reduce.matches) timer = setInterval(cycle, 4000);
        };
        const observer = new MutationObserver(syncGlyph);
        observer.observe(root, { childList: true });
        reduce.addEventListener('change', sync);
        sync();
        return () => {
          observer.disconnect();
          reduce.removeEventListener('change', sync);
          stopWords();
          glyph?.stop();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
