import { defineSilentMountWithArgs } from '../silent-mount';
import { Effect, Schema } from 'effect';
import { animate } from 'motion';
import { spring } from '../motion';
import { copyVisual } from './visual-copy';

const selectionExits = new WeakMap<HTMLElement, () => void>();

function animateSelectionBar(element: HTMLElement, entering: boolean) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tween = {
    ...spring.moderate.exit,
    type: 'tween' as const,
    ease: entering ? ('easeOut' as const) : ('easeIn' as const),
  };
  const order = <T>(hidden: T, shown: T) => (entering ? [hidden, shown] : [shown, hidden]);
  const opacity = order(0, 1);
  const transform = order(
    'translate(-50%, -100%) translateY(8px) scale(0.96)',
    'translate(-50%, -100%) translateY(0px) scale(1)',
  );
  const filter = order('blur(4px)', 'blur(0px)');
  element.style.opacity = String(opacity[0]);
  if (!reduced) {
    element.style.transform = transform[0]!;
    element.style.filter = filter[0]!;
  }
  const animation = animate(
    element,
    reduced ? { opacity } : { opacity, transform, filter },
    entering && !reduced ? { ...spring.moderate, opacity: tween } : tween,
  );
  if (entering)
    void animation.then(() => {
      element.style.opacity = '';
      element.style.transform = '';
      element.style.filter = '';
    });
  return animation;
}

function observeSelectionCount(bar: HTMLElement) {
  const count = bar.querySelector<HTMLElement>('.ff-data-table-selection-count');
  const digits = count?.querySelector<HTMLElement>('.ff-data-table-selection-digits');
  if (!count || !digits) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const timing = { duration: spring.moderate.duration * 1000, easing: 'ease-out' };
  const animations = new Set<Animation>();
  const exitingDigits = new Set<HTMLElement>();
  let previous = count.dataset.count ?? '';
  let width = digits.getBoundingClientRect().width;
  const stop = () => {
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const digit of exitingDigits) digit.remove();
    exitingDigits.clear();
  };
  const play = (node: HTMLElement, frames: Keyframe[], cleanup?: () => void) => {
    const animation = node.animate(frames, timing);
    animations.add(animation);
    const finish = () => {
      animations.delete(animation);
      cleanup?.();
    };
    void animation.finished.then(finish, finish);
  };
  const shown = { translate: '0 0', opacity: 1, filter: 'blur(0px)' };
  const hidden = (direction: number) => ({
    translate: `0 ${direction * 0.5}em`,
    opacity: 0,
    filter: 'blur(2px)',
  });
  const observer = new MutationObserver(() => {
    const next = count.dataset.count ?? '';
    if (next === previous) return;
    stop();
    const nextWidth = digits.getBoundingClientRect().width;
    if (!reduced.matches) {
      const direction = Number(next) > Number(previous) ? 1 : -1;
      for (let offset = 0; offset < Math.max(previous.length, next.length); offset++) {
        const oldDigit = previous.at(-offset - 1);
        const newDigit = next.at(-offset - 1);
        if (newDigit === oldDigit) continue;
        const live = digits.children.item(next.length - offset - 1);
        if (live instanceof HTMLElement) play(live, [hidden(direction), shown]);
        if (oldDigit === undefined) continue;
        const exiting = document.createElement('span');
        exiting.textContent = oldDigit;
        Object.assign(exiting.style, {
          position: 'absolute',
          right: `${offset}ch`,
          pointerEvents: 'none',
        });
        count.append(exiting);
        exitingDigits.add(exiting);
        play(exiting, [shown, hidden(-direction)], () => {
          exiting.remove();
          exitingDigits.delete(exiting);
        });
      }
      if (next.length !== previous.length && width > 0)
        play(count, [{ width: `${width}px` }, { width: `${nextWidth}px` }]);
    }
    previous = next;
    width = nextWidth;
  });
  observer.observe(count, { attributes: true, attributeFilter: ['data-count'] });
  reduced.addEventListener('change', stop);
  return () => {
    observer.disconnect();
    reduced.removeEventListener('change', stop);
    stop();
  };
}

export const SelectionPortal = defineSilentMountWithArgs('DataTable.SelectionPortal', {
  args: { rootId: Schema.String },
  execute: ({ element, rootId }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const root = document.getElementById(rootId);
        if (!(element instanceof HTMLElement) || !root) return () => {};
        const dialog = root.closest<HTMLDialogElement>('dialog');
        const host = dialog ?? document.body;
        const placeholder = document.createComment('selection-bar');
        element.before(placeholder);
        host.append(element);
        selectionExits.get(root)?.();
        let frame = 0;
        const place = () => {
          frame = 0;
          const anchor = root.querySelector<HTMLElement>('.ff-data-table-frame') ?? root;
          const rect = anchor.getBoundingClientRect();
          const bounds = dialog?.getBoundingClientRect();
          const top = Math.max(0, bounds?.top ?? 0);
          const bottom = Math.min(innerHeight, bounds?.bottom ?? innerHeight);
          const fixed = dialog !== null || rect.bottom > bottom;
          element.style.position = fixed ? 'fixed' : 'absolute';
          element.style.left = `${rect.left + rect.width / 2 + (fixed ? 0 : scrollX)}px`;
          element.style.top = `${Math.min(bottom, rect.bottom) + (fixed ? 0 : scrollY) - 20}px`;
          element.style.visibility =
            rect.bottom < top + 64 || rect.top > bottom - 64 ? 'hidden' : 'visible';
          const styles = getComputedStyle(root);
          element.style.setProperty('--bar-bg', styles.getPropertyValue('--foreground'));
          element.style.setProperty('--bar-fg', styles.getPropertyValue('--background'));
          let z = 50;
          for (let parent = root.parentElement; parent; parent = parent.parentElement)
            z = Math.max(z, (Number.parseInt(getComputedStyle(parent).zIndex, 10) || 0) + 1);
          element.style.zIndex = String(z);
        };
        const schedule = () => {
          if (!frame) frame = requestAnimationFrame(place);
        };
        const observer = new ResizeObserver(schedule);
        observer.observe(root);
        if (dialog) observer.observe(dialog);
        const anchor = root.querySelector('.ff-data-table-frame');
        if (anchor) observer.observe(anchor);
        const theme = new MutationObserver(schedule);
        theme.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['class', 'style', 'data-theme'],
        });
        window.addEventListener('scroll', schedule, { capture: true, passive: true });
        window.addEventListener('resize', schedule);
        place();
        const stopCount = observeSelectionCount(element);
        const entrance = animateSelectionBar(element, true);
        return () => {
          cancelAnimationFrame(frame);
          observer.disconnect();
          theme.disconnect();
          window.removeEventListener('scroll', schedule, { capture: true });
          window.removeEventListener('resize', schedule);
          entrance.stop();
          stopCount();
          if (root.isConnected && element.isConnected && element.style.visibility === 'visible') {
            const exit = copyVisual(element);
            exit.style.transform = '';
            exit.inert = true;
            exit.setAttribute('aria-hidden', 'true');
            host.append(exit);
            const animation = animateSelectionBar(exit, false);
            const remove = () => {
              exit.remove();
              if (selectionExits.get(root) === cancelExit) selectionExits.delete(root);
            };
            const cancelExit = () => {
              animation.stop();
              remove();
            };
            selectionExits.set(root, cancelExit);
            void animation.then(remove);
          }
          element.remove();
          placeholder.remove();
        };
      }),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
