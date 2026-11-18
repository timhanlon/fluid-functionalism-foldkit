import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';
import { animate, type AnimationPlaybackControls } from 'motion';
import { mountHover } from '../../fluid-hover/engine';
import { spring } from '../motion';
import './filter.css';

/** Native chip paint only; Input, Dropdown and DatePicker own editing,
 * focus, keyboard navigation and dismissal through their public primitives. */
export const FilterMounted = defineSilentMount('DataTable.FilterVisuals', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const content = element.querySelector<HTMLElement>('.ff-data-table-filter-content');
        if (!content) return () => {};
        const radius = () => {
          const shape = element.closest<HTMLElement>('.ff-data-table')?.dataset.radius;
          return shape === 'sharp' ? '0px' : shape === 'pill' ? '17px' : '5px';
        };
        const hover = mountHover(element, {
          itemSelector: '.ff-data-table-filter-segment',
          ownsItem: (item) => item.closest('.ff-data-table-filter') === element,
          axis: 'x',
          nearest: false,
          keyboardNavigation: false,
          radius,
        });
        let animation: AnimationPlaybackControls | undefined;
        let width: number | undefined;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)');
        const resize = new ResizeObserver(() => {
          const next = content.offsetWidth + 6;
          if (next === width) return;
          animation?.stop();
          if (width === undefined || reduced.matches) element.style.width = `${next}px`;
          else animation = animate(element, { width: next }, spring.moderate);
          width = next;
        });
        const typing = () =>
          element.toggleAttribute(
            'data-typing',
            element.ownerDocument.activeElement instanceof HTMLInputElement &&
              element.contains(element.ownerDocument.activeElement),
          );
        element.addEventListener('focusin', typing);
        element.addEventListener('focusout', typing);
        resize.observe(content);
        return () => {
          animation?.stop();
          resize.disconnect();
          hover.dispose();
          element.removeEventListener('focusin', typing);
          element.removeEventListener('focusout', typing);
        };
      }),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
