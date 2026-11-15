import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { Message } from './messages';

type RuntimeMessage = Extract<Message, { readonly _tag: 'Reordered' }>;
const moderate = { type: 'spring' as const, duration: 0.16, bounce: 0 };
const fast = { type: 'spring' as const, duration: 0.08, bounce: 0 };
const peek = 12,
  scaleStep = 0.05,
  gap = 8,
  maxPeek = 2;

/** Geometry, hover/tap expansion, enqueue recoil and drag-to-reorder. */
export const Mounted = Mount.defineStream('QueuedStack.Visuals', {
  messages: [Message.Reordered],
  execute: ({ element }) =>
    Stream.callback<RuntimeMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element;
          const inner = root.querySelector<HTMLElement>('.ff-qs-inner');
          if (!inner) return () => {};
          const reduced = matchMedia('(prefers-reduced-motion: reduce)');
          const touch = matchMedia('(hover: none)');
          const motions = new Set<AnimationPlaybackControls>();
          const play = (...args: Parameters<typeof animate>) => {
            const motion = animate(...args);
            motions.add(motion);
            motion.finished.then(() => motions.delete(motion));
            return motion;
          };
          const cardH = () => (root.dataset.size === 'compact' ? 38 : 44);
          let hovered = false,
            tapExpanded = false,
            pressed: string | undefined,
            dragging: string | undefined,
            dragY = 0,
            startY = 0,
            lastCount = Number(root.dataset.count);
          const cards = () => [...root.querySelectorAll<HTMLElement>('[data-qs-card]')];
          const expanded = () => hovered || tapExpanded || !!pressed || !!dragging;
          const slotY = (index: number) => -index * (cardH() + gap);
          const known = new Map<string, HTMLElement>();
          const layout = (initial = false) => {
            const isOpen = expanded();
            const list = cards();
            const count = list.length;
            root.toggleAttribute('data-expanded', isOpen);
            root.toggleAttribute('data-touch', touch.matches);
            const height = isOpen
              ? count * cardH() + Math.max(count - 1, 0) * gap
              : cardH() + Math.min(Math.max(count - 1, 0), maxPeek) * peek;
            if (initial || reduced.matches) root.style.height = `${height}px`;
            else play(root, { height: `${height}px` }, moderate);
            for (const card of list) {
              const id = card.dataset.qsCard!,
                index = Number(card.dataset.index);
              const depth = Math.min(index, maxPeek);
              const target = isOpen
                ? {
                    y: id === dragging ? dragY : slotY(index),
                    scale: id === dragging ? 1.03 : 1,
                    opacity: 1,
                  }
                : {
                    y: -depth * peek,
                    scale: 1 - depth * scaleStep,
                    opacity: index <= maxPeek ? 1 : 0,
                  };
              card.style.zIndex = String(id === dragging ? 200 : 100 - index);
              card.style.cursor = isOpen ? 'grab' : 'default';
              card.style.touchAction = isOpen ? 'none' : '';
              const fresh = !known.has(id);
              known.set(id, card);
              if (fresh && !initial && !reduced.matches) {
                play(
                  card,
                  { y: [14, target.y], scale: [0.96, target.scale], opacity: [0, target.opacity] },
                  moderate,
                );
              } else if (initial || reduced.matches || id === dragging) {
                play(card, target, { duration: 0 });
              } else play(card, target, moderate);
            }
            // Exiting cards fade and shrink from where they were.
            for (const [id, card] of known)
              if (!list.some((node) => node.dataset.qsCard === id)) {
                known.delete(id);
                if (reduced.matches || card.isConnected) continue;
                const ghost = card.cloneNode(true) as HTMLElement;
                ghost.removeAttribute('data-qs-card');
                ghost.style.pointerEvents = 'none';
                inner.append(ghost);
                play(ghost, { opacity: 0, scale: 0.9 }, { duration: 0.12 }).finished.then(() =>
                  ghost.remove(),
                );
              }
            // Once the collapsed pile is at its peek cap a new card lands out of
            // sight: recoil the whole stack so each enqueue is felt.
            if (!initial && count > lastCount && lastCount > 0 && !isOpen && !reduced.matches)
              play(inner, { y: [-7, 0] }, { type: 'spring', duration: 0.42, bounce: 0.5 });
            lastCount = count;
          };
          // Without an explicit bottom, sit 8px above the sibling composer.
          const composer = root.parentElement?.querySelector<HTMLElement>(
            ':scope > .ff-input-message',
          );
          const place = () => {
            root.style.bottom = `${root.dataset.bottom ?? (composer ? composer.offsetHeight + 8 : 0)}px`;
          };
          const sizes = new ResizeObserver(place);
          if (composer) sizes.observe(composer);
          const observer = new MutationObserver(() => {
            place();
            layout();
          });
          observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-index', 'data-count', 'data-bottom'],
          });

          const enter = () => {
            hovered = true;
            layout();
          };
          const leave = () => {
            hovered = false;
            layout();
          };
          const down = (event: PointerEvent) => {
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest('[data-qs-collapse]')) return;
            const card = target?.closest<HTMLElement>('[data-qs-card]');
            if (!card || target?.closest('button')) return;
            // Touch tap-to-expand: a collapsed pile fans out on tap.
            if (touch.matches && !expanded()) {
              tapExpanded = true;
              layout();
              return;
            }
            if (!expanded() || event.button !== 0) return;
            startY = event.clientY;
            pressed = card.dataset.qsCard;
            dragY = slotY(Number(card.dataset.index));
            layout();
          };
          const move = (event: PointerEvent) => {
            if (!pressed) return;
            if (!dragging) {
              if (Math.abs(event.clientY - startY) < 4) return;
              dragging = pressed;
            }
            const rect = root.getBoundingClientRect();
            const ids = cards()
              .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
              .map((card) => card.dataset.qsCard!);
            const slot = Math.max(
              0,
              Math.min(ids.length - 1, Math.floor((rect.bottom - event.clientY) / (cardH() + gap))),
            );
            const current = ids.indexOf(pressed);
            if (current !== -1 && current !== slot) {
              ids.splice(current, 1);
              ids.splice(slot, 0, pressed);
              Queue.offerUnsafe(queue, Message.Reordered({ ids }));
            }
            dragY = Math.max(
              -(ids.length - 1) * (cardH() + gap),
              Math.min(0, event.clientY - rect.bottom + cardH() / 2),
            );
            layout();
          };
          const up = () => {
            if (!pressed) return;
            pressed = undefined;
            dragging = undefined;
            layout();
          };
          const collapse = (event: MouseEvent) => {
            if (!(event.target instanceof Element) || !event.target.closest('[data-qs-collapse]'))
              return;
            event.stopPropagation();
            tapExpanded = false;
            layout();
          };
          root.addEventListener('pointerenter', enter);
          root.addEventListener('pointerleave', leave);
          root.addEventListener('pointerdown', down);
          root.addEventListener('click', collapse);
          window.addEventListener('pointermove', move);
          window.addEventListener('pointerup', up);
          window.addEventListener('pointercancel', up);
          place();
          layout(true);
          if (!reduced.matches) play(root, { opacity: [0, 1] }, fast);
          return () => {
            observer.disconnect();
            sizes.disconnect();
            root.removeEventListener('pointerenter', enter);
            root.removeEventListener('pointerleave', leave);
            root.removeEventListener('pointerdown', down);
            root.removeEventListener('click', collapse);
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', up);
            motions.forEach((motion) => motion.stop());
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
