import { defineSilentMount } from '../silent-mount';
import { shapeRadius } from '../shape';
import { Effect } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { mountHover } from '../../fluid-hover/engine';
import { mountListFocus } from '../list-focus';

export const Mounted = defineSilentMount('RadioGroup.Mount', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root = element;
        const rows = () =>
          [...root.querySelectorAll<HTMLElement>('.ff-radio')].filter(
            (row) => row.closest('.ff-radio-group') === root,
          );
        const hover = mountHover(root, {
          itemSelector: '.ff-radio',
          ownsItem: (row) => row.closest('.ff-radio-group') === root,
          nearest: false,
          axis: 'y',
          radius: () => `${shapeRadius(root.dataset.radius, 8, 20, 1)}px`,
        });
        const focus = mountListFocus(root, rows);
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const background = document.createElement('div');
        background.className = 'ff-radio-selection';
        background.setAttribute('aria-hidden', 'true');
        root.prepend(background);
        let motion: AnimationPlaybackControls | undefined,
          initialized = false;
        const dots = new Map<
          HTMLElement,
          { checked: boolean; animation?: AnimationPlaybackControls }
        >();
        const sync = () => {
          const selected = rows().find((row) => row.getAttribute('aria-checked') === 'true');
          motion?.stop();
          if (!selected) {
            background.hidden = true;
            initialized = false;
          } else {
            const geometry = {
              top: selected.offsetTop,
              left: selected.offsetLeft,
              width: selected.offsetWidth,
              height: selected.offsetHeight,
            };
            background.hidden = false;
            background.style.borderRadius = `${shapeRadius(root.dataset.radius, 8, 20, 1)}px`;
            if (!initialized || reduced.matches)
              Object.assign(background.style, {
                top: `${geometry.top}px`,
                left: `${geometry.left}px`,
                width: `${geometry.width}px`,
                height: `${geometry.height}px`,
              });
            else
              motion = animate(background, geometry, { type: 'spring', duration: 0.16, bounce: 0 });
            initialized = true;
          }
          for (const row of rows()) {
            const dot = row.querySelector<HTMLElement>('.ff-radio-dot');
            if (!dot) continue;
            const checked = row.getAttribute('aria-checked') === 'true',
              previous = dots.get(dot);
            if (previous?.checked === checked) continue;
            previous?.animation?.stop();
            if (!previous || reduced.matches) {
              Object.assign(dot.style, {
                opacity: checked ? '1' : '0',
                transform: `scale(${checked ? 1 : 0.3})`,
              });
              dots.set(dot, { checked });
            } else
              dots.set(dot, {
                checked,
                animation: animate(
                  dot,
                  { opacity: checked ? 1 : 0, scale: checked ? 1 : 0.3 },
                  checked ? { type: 'spring', duration: 0.08, bounce: 0 } : { duration: 0.04 },
                ),
              });
          }
        };
        // Fluid accepts both arrow axes in its vertical list. Foldkit supplies the
        // vertical axis; these two keys select through the same primitive click.
        const key = (event: KeyboardEvent) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          const available = rows().filter((row) => !row.matches(':disabled'));
          const index = available.indexOf(event.target as HTMLElement);
          if (index < 0) return;
          event.preventDefault();
          event.stopPropagation();
          const next =
            available[
              (index + (event.key === 'ArrowRight' ? 1 : -1) + available.length) % available.length
            ];
          next?.focus();
          next?.click();
        };
        const change = new MutationObserver(sync);
        change.observe(root, {
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-checked', 'data-size', 'data-radius'],
        });
        const resize = new ResizeObserver(sync);
        resize.observe(root);
        root.addEventListener('keydown', key, true);
        sync();
        return () => {
          hover.dispose();
          focus();
          motion?.stop();
          dots.forEach((dot) => dot.animation?.stop());
          change.disconnect();
          resize.disconnect();
          background.remove();
          root.removeEventListener('keydown', key, true);
        };
      }),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
