import { shapeRadius } from '../shape';
import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { mountHover } from '../../fluid-hover/engine';
import { Message } from './state';

type RuntimeMessage = Extract<Message, { readonly _tag: 'SuggestionHovered' | 'HistoryStepped' }>;
const fast = { type: 'spring' as const, duration: 0.08, bounce: 0 };
const moderate = { type: 'spring' as const, duration: 0.16, bounce: 0 };
const exitTween = { duration: 0.06 };

/** Visual projection for the composer; the model owns every decision. */
export const Mounted = Mount.defineStream('InputMessage.Visuals', {
  messages: [Message.SuggestionHovered, Message.HistoryStepped],
  execute: ({ element }) =>
    Stream.callback<RuntimeMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element;
          const field = root.querySelector<HTMLTextAreaElement>('textarea.ff-im-field');
          if (!field) return () => {};
          const reduced = matchMedia('(prefers-reduced-motion: reduce)');
          const touch = matchMedia('(hover: none)');
          const motions = new Set<AnimationPlaybackControls>();
          const play = (...args: Parameters<typeof animate>) => {
            const motion = animate(...args);
            motions.add(motion);
            motion.finished.then(() => motions.delete(motion));
            return motion;
          };
          const syncTouch = () => root.toggleAttribute('data-touch', touch.matches);

          // ── Auto-growing textarea, between min and max rows ──────────────
          let lineHeight = 0,
            lastValue: string | undefined,
            lastWidth = field.offsetWidth;
          const resize = () => {
            if (!lineHeight) lineHeight = parseFloat(getComputedStyle(field).lineHeight) || 20;
            const min = lineHeight * Number(root.dataset.minRows ?? 1),
              max = lineHeight * Number(root.dataset.maxRows ?? 8);
            field.style.height = 'auto';
            const pad =
              parseFloat(getComputedStyle(field).paddingTop) +
              parseFloat(getComputedStyle(field).paddingBottom);
            const next = Math.min(Math.max(field.scrollHeight - pad, min), max) + pad;
            field.style.height = `${next}px`;
            field.style.overflowY = field.scrollHeight - pad > max ? 'auto' : 'hidden';
            lastValue = field.value;
          };

          // ── Collapsible regions spring to a measured pixel height ─────────
          const regions = new Map<
            HTMLElement,
            { open: boolean; motion?: AnimationPlaybackControls }
          >();
          // A closed region leaves the layout once collapsed, as upstream's
          // AnimatePresence unmounts it, so it stops taking the column's gap.
          const syncRegions = (initial = false) => {
            for (const region of root.querySelectorAll<HTMLElement>('[data-im-region]')) {
              const open = region.hasAttribute('data-open');
              const state = regions.get(region);
              if (open) region.style.display = '';
              const target = open ? region.scrollHeight : 0;
              // Suggestions exit height-only, so the divider holds until the space closes.
              const opacity = open || region.dataset.imRegion === 'suggestions' ? '1' : '0';
              if (initial || !state || reduced.matches) {
                region.style.height = `${target}px`;
                region.style.opacity = opacity;
                if (!open) region.style.display = 'none';
                regions.set(region, { open });
                continue;
              }
              if (state.open === open && (!open || Math.abs(region.offsetHeight - target) < 0.5))
                continue;
              state.motion?.stop();
              if (!open && state.open === false) continue;
              const motion = play(
                region,
                { height: `${target}px`, opacity: Number(opacity) },
                moderate,
              );
              state.motion = motion;
              state.open = open;
              if (!open)
                motion.finished.then(() => {
                  if (!region.hasAttribute('data-open') && state.motion === motion)
                    region.style.display = 'none';
                });
            }
          };

          // ── Tiles and queued rows: enter, exit ghosts, sibling slides ─────
          const tracked = (selector: string, attribute: string, scale: number) => {
            let previous = new Map<string, { node: HTMLElement; left: number; top: number }>();
            const measure = () =>
              new Map(
                [...root.querySelectorAll<HTMLElement>(selector)].map((node) => [
                  node.getAttribute(attribute)!,
                  { node, left: node.offsetLeft, top: node.offsetTop },
                ]),
              );
            return (initial: boolean) => {
              const current = measure();
              if (!initial && !reduced.matches) {
                for (const [key, old] of previous)
                  if (!current.has(key) && old.node.parentElement === null) {
                    const container = root.querySelector<HTMLElement>(
                      selector === '[data-im-tile]' ? '.ff-im-files' : '.ff-im-queue',
                    );
                    if (!container) continue;
                    const ghost = old.node.cloneNode(true) as HTMLElement;
                    ghost.removeAttribute(attribute);
                    ghost.dataset.imGhost = '';
                    Object.assign(ghost.style, {
                      position: 'absolute',
                      left: `${old.left}px`,
                      top: `${old.top}px`,
                      pointerEvents: 'none',
                      margin: '0',
                    });
                    container.append(ghost);
                    play(ghost, { opacity: 0, scale }, exitTween).finished.then(() =>
                      ghost.remove(),
                    );
                  }
                for (const [key, now] of current) {
                  const old = previous.get(key);
                  if (!old) play(now.node, { opacity: [0, 1], scale: [scale, 1] }, fast);
                  else if (old.left !== now.left || old.top !== now.top)
                    play(
                      now.node,
                      { x: [old.left - now.left, 0], y: [old.top - now.top, 0] },
                      fast,
                    );
                }
              }
              previous = current;
            };
          };
          const tiles = tracked('[data-im-tile]', 'data-im-tile', 0.9);
          const rows = tracked('[data-im-queued]', 'data-im-queued', 0.97);

          // ── Send glyph: Stop ⇄ arrow swap ─────────────────────────────────
          let mode = root.querySelector<HTMLElement>('[data-im-mode]')?.dataset.imMode;
          const syncSend = () => {
            const button = root.querySelector<HTMLElement>('[data-im-mode]');
            const next = button?.dataset.imMode;
            if (next === mode) return;
            mode = next;
            const glyph = button?.querySelector<HTMLElement>('.ff-im-send-glyph');
            if (glyph && !reduced.matches) play(glyph, { opacity: [0, 1], scale: [0.6, 1] }, fast);
            else if (glyph) play(glyph, { opacity: [0, 1] }, fast);
          };

          // ── Suggested prompts: one sliding fill for pointer and keyboard ──
          // The engine settles a pick on the next frame, so a programmatic move
          // could report after a later keypress; only picks that follow a real
          // pointer move are reported.
          let hover: ReturnType<typeof mountHover> | undefined,
            fromPointer = false;
          let hoverNode: HTMLElement | undefined;
          const list = () => root.querySelector<HTMLElement>('.ff-im-suggestions');
          const attachHover = () => {
            const node = list();
            if (!node || hover) return;
            hover = mountHover(node, {
              itemSelector: '[role=option]',
              axis: 'y',
              nearest: false,
              keyboardNavigation: false,
              focusHighlight: false,
              radius: () => `${shapeRadius(root.dataset.radius, 8, 20, 1)}px`,
              onPick: (index) => {
                if (!fromPointer) return;
                fromPointer = false;
                Queue.offerUnsafe(queue, Message.SuggestionHovered({ index: index ?? -1 }));
              },
            });
            hoverNode = node;
            node.addEventListener('pointermove', pointer, true);
            node.addEventListener('pointerleave', pointer, true);
          };
          const syncHighlight = () => {
            attachHover();
            const row = list()?.querySelector<HTMLElement>('[role=option][data-active]');
            fromPointer = false;
            if (row) {
              const rect = row.getBoundingClientRect();
              hover?.move(rect.left + rect.width / 2, rect.top + rect.height / 2, row);
            } else hover?.leave();
          };
          function pointer(event: PointerEvent) {
            if (event.pointerType !== 'touch') fromPointer = true;
          }

          const sync = (initial = false) => {
            if (field.value !== lastValue) resize();
            syncRegions(initial);
            tiles(initial);
            rows(initial);
            syncSend();
            syncHighlight();
          };
          const observer = new MutationObserver(() => sync());
          // Only the state the view sets: the runtime's own style writes (region
          // heights, the hover layer, slides) must not re-enter sync.
          observer.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: [
              'data-open',
              'data-im-mode',
              'data-active',
              'aria-selected',
              'disabled',
              'data-history-up',
              'data-history-down',
              'data-drag-over',
            ],
          });
          const widths = new ResizeObserver(() => {
            if (field.offsetWidth === lastWidth) return;
            lastWidth = field.offsetWidth;
            resize();
            syncRegions();
          });
          widths.observe(field);

          // ── Keys only the runtime can judge: history needs the caret line ──
          const keydown = (event: KeyboardEvent) => {
            if (event.isComposing || event.keyCode === 229) {
              event.stopPropagation();
              return;
            }
            if (
              event.target !== field ||
              event.shiftKey ||
              event.altKey ||
              event.metaKey ||
              event.ctrlKey
            )
              return;
            const caret = field.selectionStart ?? 0,
              end = field.selectionEnd ?? caret;
            const up =
              event.key === 'ArrowUp' &&
              root.hasAttribute('data-history-up') &&
              !field.value.slice(0, caret).includes('\n');
            const down =
              event.key === 'ArrowDown' &&
              root.hasAttribute('data-history-down') &&
              !field.value.slice(end).includes('\n');
            if (!up && !down) return;
            event.preventDefault();
            event.stopPropagation();
            Queue.offerUnsafe(queue, Message.HistoryStepped({ step: up ? -1 : 1 }));
          };
          // Clicking the composer's empty space focuses the field.
          const mousedown = (event: MouseEvent) => {
            if (!root.hasAttribute('data-click-to-focus') || event.target === field) return;
            if (
              event.target instanceof Element &&
              event.target.closest(
                'button,a,input,select,textarea,[contenteditable],[role=button],[data-im-queue],[role=option]',
              )
            )
              return;
            event.preventDefault();
            field.focus();
          };
          // A suggestion press keeps focus in the field.
          const keepFocus = (event: MouseEvent) => {
            if (event.target instanceof Element && event.target.closest('.ff-im-suggestions'))
              event.preventDefault();
          };
          root.addEventListener('keydown', keydown, true);
          root.addEventListener('mousedown', mousedown);
          root.addEventListener('mousedown', keepFocus);
          field.addEventListener('input', resize);
          touch.addEventListener('change', syncTouch);
          syncTouch();
          resize();
          sync(true);
          return () => {
            observer.disconnect();
            widths.disconnect();
            root.removeEventListener('keydown', keydown, true);
            root.removeEventListener('mousedown', mousedown);
            root.removeEventListener('mousedown', keepFocus);
            field.removeEventListener('input', resize);
            touch.removeEventListener('change', syncTouch);
            motions.forEach((motion) => motion.stop());
            hoverNode?.removeEventListener('pointermove', pointer, true);
            hoverNode?.removeEventListener('pointerleave', pointer, true);
            hover?.dispose();
            root.querySelectorAll('[data-im-ghost]').forEach((ghost) => ghost.remove());
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
