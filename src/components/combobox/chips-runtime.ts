import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { Combobox as Primitive } from '@foldkit/ui';
import { animate, type AnimationPlaybackControls } from 'motion';
import { Message } from './multi-state';
type RuntimeMessage = Extract<Message, { readonly _tag: 'Removed' | 'Behavior' }>;
export const Mounted = Mount.defineStream('Combobox.Chips', {
  messages: [Message.Removed, Message.Behavior],
  execute: ({ element }) =>
    Stream.callback<RuntimeMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element,
            field = root.closest<HTMLElement>('.ff-combobox-input-wrapper'),
            combo = root.closest<HTMLElement>('.ff-combobox'),
            input = root.querySelector<HTMLInputElement>('input');
          if (!field || !input || !combo) return () => {};
          const chips = () => [
            ...root.querySelectorAll<HTMLElement>('[data-combobox-chip]:not([data-chip-ghost])'),
          ];
          const reduced = matchMedia('(prefers-reduced-motion: reduce)');
          const motions = new Set<AnimationPlaybackControls>();
          const ghosts = new Set<HTMLElement>();
          let frame = 0,
            height: number | undefined,
            heightMotion: AnimationPlaybackControls | undefined;
          let pending: { removed: string; target?: string } | undefined;
          let previous = new Map<
            string,
            { node: HTMLElement; left: number; top: number; width: number; height: number }
          >();
          const play = (
            node: HTMLElement,
            keyframes: Parameters<typeof animate>[1],
            transition: Parameters<typeof animate>[2],
          ) => {
            const motion = animate(node, keyframes, transition);
            motions.add(motion);
            motion.finished.then(() => motions.delete(motion));
            return motion;
          };
          const measure = () => {
            frame = 0;
            const current = new Map(
              chips().map((node) => [
                node.dataset.value!,
                {
                  node,
                  left: node.offsetLeft,
                  top: node.offsetTop,
                  width: node.offsetWidth,
                  height: node.offsetHeight,
                },
              ]),
            );
            for (const [value, old] of previous)
              if (!current.has(value) && !reduced.matches) {
                const ghost = old.node.cloneNode(true) as HTMLElement;
                ghost.dataset.chipGhost = '';
                ghost.setAttribute('aria-hidden', 'true');
                ghost.inert = true;
                Object.assign(ghost.style, {
                  position: 'absolute',
                  left: `${old.left}px`,
                  top: `${old.top}px`,
                  width: `${old.width}px`,
                  height: `${old.height}px`,
                  pointerEvents: 'none',
                });
                root.append(ghost);
                ghosts.add(ghost);
                play(
                  ghost,
                  { opacity: [1, 0], scale: [1, 0.9] },
                  { duration: 0.06, ease: 'easeOut' },
                ).finished.then(() => {
                  ghosts.delete(ghost);
                  ghost.remove();
                });
              }
            for (const [value, row] of current) {
              const old = previous.get(value);
              if (height !== undefined && !reduced.matches) {
                if (!old)
                  play(
                    row.node,
                    { opacity: [0, 1], scale: [0.9, 1] },
                    { type: 'spring', duration: 0.08, bounce: 0 },
                  );
                else if (old.left !== row.left || old.top !== row.top)
                  play(
                    row.node,
                    { x: [old.left - row.left, 0], y: [old.top - row.top, 0] },
                    { type: 'spring', duration: 0.08, bounce: 0 },
                  );
              }
            }
            previous = current;
            const target = root.offsetHeight + (combo.dataset.size === 'compact' ? 8 : 12);
            if (root.offsetHeight > 0 && height !== target) {
              heightMotion?.stop();
              if (height === undefined || reduced.matches) field.style.height = `${target}px`;
              else
                heightMotion = animate(
                  field,
                  { height: target },
                  { type: 'spring', duration: 0.08, bounce: 0 },
                );
              height = target;
            }
            if (pending && !current.has(pending.removed)) {
              (pending.target ? (current.get(pending.target)?.node ?? input) : input).focus();
              pending = undefined;
            }
          };
          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
          };
          const remove = (node: HTMLElement, target?: HTMLElement) => {
            if (combo.hasAttribute('data-disabled') || combo.hasAttribute('data-readonly')) return;
            const value = node.dataset.value;
            if (value === undefined) return;
            pending = { removed: value, target: target?.dataset.value };
            Queue.offerUnsafe(queue, Message.Removed({ value }));
          };
          const key = (event: KeyboardEvent) => {
            if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
            const rows = chips(),
              chip =
                event.target instanceof Element
                  ? event.target.closest<HTMLElement>('[data-combobox-chip]')
                  : undefined;
            const rtl = getComputedStyle(root).direction === 'rtl';
            const backward = event.key === (rtl ? 'ArrowRight' : 'ArrowLeft'),
              forward = event.key === (rtl ? 'ArrowLeft' : 'ArrowRight');
            if (event.target === input && input.value === '' && rows.length) {
              if (backward) {
                event.preventDefault();
                event.stopPropagation();
                rows.at(-1)?.focus();
              } else if (event.key === 'Backspace' && !combo.hasAttribute('data-readonly')) {
                event.preventDefault();
                event.stopPropagation();
                remove(rows.at(-1)!);
              }
            } else if (chip && !chip.hasAttribute('data-chip-ghost')) {
              const index = rows.indexOf(chip);
              if (backward || forward) {
                event.preventDefault();
                event.stopPropagation();
                (rows[index + (backward ? -1 : 1)] ?? input).focus();
              } else if (
                ['Backspace', 'Delete'].includes(event.key) &&
                !combo.hasAttribute('data-readonly')
              ) {
                event.preventDefault();
                event.stopPropagation();
                remove(chip, rows[index + 1] ?? rows[index - 1]);
              }
            }
          };
          const pointer = (event: PointerEvent) => {
            const removeButton =
              event.target instanceof Element
                ? event.target.closest('[data-chip-remove]')
                : undefined;
            const chip = removeButton?.closest<HTMLElement>('[data-combobox-chip]');
            if (chip) {
              event.preventDefault();
              pending = { removed: chip.dataset.value! };
            }
          };
          const blur = (event: FocusEvent) => {
            if (
              event.target === input &&
              event.relatedTarget instanceof Node &&
              root.contains(event.relatedTarget)
            )
              event.stopImmediatePropagation();
          };
          const focusout = (event: FocusEvent) => {
            // Removing the focused chip briefly leaves no focused element.
            // The pending removal restores input/neighbor focus after layout;
            // this transient blur must not dismiss the list.
            if (
              pending &&
              event.relatedTarget === null &&
              event.target instanceof Element &&
              event.target.closest<HTMLElement>('[data-combobox-chip]')?.dataset.value ===
                pending.removed
            )
              return;
            if (
              event.target !== input &&
              !(event.relatedTarget instanceof Node && combo.contains(event.relatedTarget))
            )
              Queue.offerUnsafe(
                queue,
                Message.Behavior({
                  message: Primitive.Message.BlurredInput({
                    restingInputValue: '',
                    isClearable: true,
                  }),
                }),
              );
          };
          const observer = new MutationObserver(schedule);
          observer.observe(root, { childList: true, subtree: true });
          const resize = new ResizeObserver(schedule);
          resize.observe(root);
          const shape = new MutationObserver(schedule);
          shape.observe(combo, { attributes: true, attributeFilter: ['data-size'] });
          root.addEventListener('keydown', key, true);
          root.addEventListener('pointerdown', pointer, true);
          root.addEventListener('blur', blur, true);
          root.addEventListener('focusout', focusout);
          measure();
          return () => {
            cancelAnimationFrame(frame);
            observer.disconnect();
            resize.disconnect();
            shape.disconnect();
            root.removeEventListener('keydown', key, true);
            root.removeEventListener('pointerdown', pointer, true);
            root.removeEventListener('blur', blur, true);
            root.removeEventListener('focusout', focusout);
            heightMotion?.stop();
            motions.forEach((motion) => motion.stop());
            ghosts.forEach((ghost) => ghost.remove());
            field.style.removeProperty('height');
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
