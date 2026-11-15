import { shapeRadius } from '../shape';
import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { mountHover } from '../../fluid-hover/engine';
import { Message, channels, type Channel } from './state';
import '../../fluid-hover/styles.css';

type RuntimeMessage = Extract<
  Message,
  {
    readonly _tag: 'SquareMoved' | 'ChannelCommitted' | 'EyedropperDetected' | 'FormatOpenChanged';
  }
>;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const isChannel = (value: string | undefined): value is Channel =>
  channels.includes(value as Channel);

/** Reflect the parent's controlled menu value without changing Menu focus policy. */
type FormatMenuMessage = typeof Message.FormatOpenChanged.Type;
function installFormatMenuControl(element: Element, offer: (message: FormatMenuMessage) => void) {
  let previous: string | undefined;
  const sync = () => {
    const value = element.getAttribute('data-cp-format-open') ?? 'auto';
    if (value === previous) return;
    previous = value;
    offer(Message.FormatOpenChanged({ open: value === 'auto' ? null : value === 'true' }));
  };
  const observer = new MutationObserver(sync);
  observer.observe(element, {
    attributes: true,
    attributeFilter: ['data-cp-format-open'],
  });
  sync();
  return () => {
    observer.disconnect();
  };
}
export const FormatMenuControl = Mount.defineStream('ColorPicker.FormatMenuControl', {
  messages: [Message.FormatOpenChanged],
  execute: ({ element }) =>
    Stream.callback<FormatMenuMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          installFormatMenuControl(element, (message) => {
            Queue.offerUnsafe(queue, message);
          }),
        ),
        (dispose) => Effect.sync(dispose),
      ),
    ),
});

/** A field's display string for a number, in its own precision and suffix. */
function display(input: HTMLInputElement, n: number) {
  const { min, max, decimals, wrap, percent } = input.dataset;
  let bounded = n;
  const lo = Number(min),
    hi = Number(max);
  if (wrap !== undefined) {
    if (bounded < lo || bounded > hi) {
      const range = hi - lo;
      bounded = ((((bounded - lo) % range) + range) % range) + lo;
    }
  } else bounded = Math.min(hi, Math.max(lo, bounded));
  const text = decimals ? bounded.toFixed(Number(decimals)) : String(Math.round(bounded));
  return percent !== undefined ? `${text}%` : text;
}

/** The ↔ arrow that stands in for the cursor pointer lock hides. */
function scrubCursor() {
  const cursor = document.createElement('div');
  cursor.className = 'ff-cp-scrub-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML =
    '<svg width="24" height="14" viewBox="0 0 24 14" fill="#000" stroke="#fff" stroke-width="1"><path d="M0.5 7l5-5v3.5h13V2l5 5-5 5V8.5h-13V12l-5-5z"/></svg>';
  return cursor;
}

/** Pointer and field behavior upstream keeps in component state: the
 * square's drag and ghost ring, draft-and-commit channel fields (Enter
 * commits, Escape reverts, arrows nudge), drag-to-scrub numeric fields with a
 * virtual cursor, the swatch grid's fluid hover, and EyeDropper detection. */
export const Mounted = Mount.defineStream('ColorPicker.Interaction', {
  messages: [
    Message.SquareMoved,
    Message.ChannelCommitted,
    Message.EyedropperDetected,
    Message.FormatOpenChanged,
  ],
  execute: ({ element }) =>
    Stream.callback<RuntimeMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element;
          const offer = (message: RuntimeMessage) => Queue.offerUnsafe(queue, message);
          if ('EyeDropper' in window) offer(Message.EyedropperDetected());
          const cleanups: Array<() => void> = [installFormatMenuControl(root, offer)];
          const on = <K extends keyof HTMLElementEventMap>(
            target: HTMLElement | Window | Document,
            type: K,
            listener: (event: HTMLElementEventMap[K]) => void,
            options?: AddEventListenerOptions,
          ) => {
            target.addEventListener(type, listener as EventListener, options);
            cleanups.push(() =>
              target.removeEventListener(type, listener as EventListener, options),
            );
          };

          // Saturation square: the press sets the color, capture keeps the
          // drag alive past the edges, where the clamp pins the thumb.
          const square = () => root.querySelector<HTMLElement>('.ff-cp-square');
          const ghost = () => root.querySelector<HTMLElement>('.ff-cp-ghost');
          let dragging = false;
          let dragRect: DOMRect | undefined;
          // Accent changes dirty styles across the page. Reading layout on
          // every pointer sample forces that work into the drag handler.
          const point = (event: PointerEvent) => {
            const rect = dragRect ?? square()!.getBoundingClientRect();
            if (dragging) dragRect = rect;
            return {
              x: clamp01((event.clientX - rect.left) / rect.width),
              y: clamp01((event.clientY - rect.top) / rect.height),
            };
          };
          const placeGhost = (event: PointerEvent | null) => {
            const ring = ghost();
            if (!ring) return;
            if (!event || dragging) {
              ring.removeAttribute('data-shown');
              return;
            }
            const { x, y } = point(event);
            ring.style.left = `${x * 100}%`;
            ring.style.top = `${y * 100}%`;
            ring.setAttribute('data-shown', '');
          };
          on(root, 'pointerdown', (event) => {
            const target = (event.target as HTMLElement).closest('.ff-cp-square');
            if (!target || (event.pointerType === 'mouse' && event.button !== 0)) return;
            event.preventDefault();
            dragRect = target.getBoundingClientRect();
            dragging = true;
            (target as HTMLElement).setPointerCapture(event.pointerId);
            placeGhost(null);
            const { x, y } = point(event);
            offer(Message.SquareMoved({ s: x, v: 1 - y }));
          });
          on(root, 'pointermove', (event) => {
            if (!(event.target as HTMLElement).closest('.ff-cp-square')) return;
            if (!dragging) return placeGhost(event);
            const { x, y } = point(event);
            offer(Message.SquareMoved({ s: x, v: 1 - y }));
          });
          const release = (event: PointerEvent) => {
            if (!dragging) return;
            dragging = false;
            if ((event.target as HTMLElement).closest?.('.ff-cp-square')) placeGhost(event);
            dragRect = undefined;
          };
          on(root, 'pointerup', release);
          on(root, 'pointercancel', release);
          const invalidateDragRect = () => {
            dragRect = undefined;
          };
          on(window, 'scroll', invalidateDragRect, { capture: true, passive: true });
          on(window, 'resize', invalidateDragRect);
          on(root, 'pointerout', (event) => {
            if (
              (event.target as HTMLElement).closest('.ff-cp-square') &&
              !square()?.contains(event.relatedTarget as Node | null)
            )
              placeGhost(null);
          });

          // Escape in the format menu closes the menu only, not a popover the
          // panel sits in.
          on(root, 'keydown', (event) => {
            if (
              event.key === 'Escape' &&
              (event.target as HTMLElement).closest('.ff-popup[data-cp-format]')
            )
              event.stopPropagation();
          });

          // Channel fields: typing edits the DOM draft, committed on blur.
          const fieldOf = (input: HTMLInputElement) => input.closest<HTMLElement>('.ff-cp-field');
          const syncFields = () => {
            for (const input of root.querySelectorAll<HTMLInputElement>('.ff-cp-input')) {
              if (!fieldOf(input)?.hasAttribute('data-editing')) {
                const value = input.dataset.value ?? '';
                if (input.value !== value) input.value = value;
              }
            }
          };
          const fields = new MutationObserver(syncFields);
          fields.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['data-value'],
          });
          syncFields();
          cleanups.push(() => fields.disconnect());
          const commit = (input: HTMLInputElement, value: string) => {
            const channel = input.dataset.channel;
            if (isChannel(channel)) offer(Message.ChannelCommitted({ channel, value }));
            // A commit that changes nothing (or is rejected) leaves the field
            // showing its last good value.
            requestAnimationFrame(() => {
              if (document.activeElement !== input) input.value = input.dataset.value ?? '';
            });
          };
          let scrubPress = false;
          on(root, 'focusin', (event) => {
            const input = event.target as HTMLElement;
            if (!(input instanceof HTMLInputElement) || !input.classList.contains('ff-cp-input'))
              return;
            if (scrubPress) return;
            fieldOf(input)?.setAttribute('data-editing', '');
            input.select();
          });
          on(root, 'focusout', (event) => {
            const input = event.target as HTMLElement;
            if (!(input instanceof HTMLInputElement) || !input.classList.contains('ff-cp-input'))
              return;
            fieldOf(input)?.removeAttribute('data-editing');
            if (input.value !== input.dataset.value) commit(input, input.value);
          });
          on(root, 'keydown', (event) => {
            const input = event.target as HTMLElement;
            if (!(input instanceof HTMLInputElement) || !input.classList.contains('ff-cp-input'))
              return;
            if (event.key === 'Enter') input.blur();
            else if (event.key === 'Escape') {
              input.value = input.dataset.value ?? '';
              input.blur();
            } else if (
              input.dataset.step &&
              (event.key === 'ArrowUp' || event.key === 'ArrowDown')
            ) {
              event.preventDefault();
              const current = parseFloat(input.value.replace('%', ''));
              if (Number.isNaN(current)) return;
              const step = Number(event.shiftKey ? input.dataset.shiftStep : input.dataset.step);
              const next = display(input, current + (event.key === 'ArrowUp' ? step : -step));
              input.value = next;
              const channel = input.dataset.channel;
              if (isChannel(channel)) offer(Message.ChannelCommitted({ channel, value: next }));
            }
          });

          // Scrub: drag sideways to change the value (1px per step); a press
          // without travel edits as text instead.
          let scrub:
            | {
                input: HTMLInputElement;
                area: HTMLElement;
                start: number;
                travel: number;
                lastX: number;
                moved: boolean;
                cursor?: HTMLElement;
                x: number;
                y: number;
              }
            | undefined;
          on(
            root,
            'pointerdown',
            (event) => {
              const area = (event.target as HTMLElement).closest<HTMLElement>('.ff-cp-scrub');
              const field = area?.closest<HTMLElement>('.ff-cp-field');
              if (!area || !field || field.hasAttribute('data-editing')) return;
              if (event.pointerType === 'mouse' && event.button !== 0) return;
              const input = area.querySelector<HTMLInputElement>('.ff-cp-input');
              if (!input) return;
              event.preventDefault();
              scrubPress = true;
              area.setPointerCapture(event.pointerId);
              scrub = {
                input,
                area,
                start: parseFloat((input.dataset.value ?? '').replace('%', '')),
                travel: 0,
                lastX: event.clientX,
                moved: false,
                x: event.clientX,
                y: event.clientY,
              };
            },
            { capture: true },
          );
          on(window, 'pointermove', (event) => {
            if (!scrub) return;
            const locked = document.pointerLockElement === scrub.area;
            const dx = locked ? event.movementX : event.clientX - scrub.lastX;
            scrub.lastX = event.clientX;
            if (!dx) return;
            if (!scrub.moved) {
              scrub.moved = true;
              try {
                const request = scrub.area.requestPointerLock?.();
                if (request instanceof Promise) request.catch(() => {});
              } catch {
                // Pointer lock refused: scrub on plain pointer moves.
              }
              scrub.cursor = scrubCursor();
              document.body.append(scrub.cursor);
            }
            scrub.travel += dx;
            scrub.x = (((scrub.x + dx) % innerWidth) + innerWidth) % innerWidth;
            if (scrub.cursor)
              scrub.cursor.style.transform = `translate(${scrub.x - 12}px, ${scrub.y - 7}px)`;
            if (Number.isNaN(scrub.start)) return;
            const step = Number(scrub.input.dataset.step ?? 1);
            const next = display(scrub.input, scrub.start + Math.trunc(scrub.travel) * step);
            if (next === scrub.input.value) return;
            scrub.input.value = next;
            const channel = scrub.input.dataset.channel;
            if (isChannel(channel)) offer(Message.ChannelCommitted({ channel, value: next }));
          });
          const endScrub = () => {
            if (!scrub) return;
            const { input, moved, cursor } = scrub;
            scrub = undefined;
            cursor?.remove();
            if (document.pointerLockElement) document.exitPointerLock();
            scrubPress = false;
            if (moved) return;
            fieldOf(input)?.setAttribute('data-editing', '');
            input.focus();
            input.select();
          };
          on(window, 'pointerup', endScrub);
          on(window, 'pointercancel', endScrub);

          // formatOpen's pinned menu: below its trigger, flipped above when
          // the visible area (viewport within any clipping ancestor, 5px in)
          // has no room below, as Base UI's collision handling does.
          let placeFrame = 0;
          const placeMenu = () => {
            cancelAnimationFrame(placeFrame);
            placeFrame = requestAnimationFrame(() => {
              const menu = root.querySelector<HTMLElement>('.ff-cp-pinned-menu');
              const trigger = menu?.parentElement?.querySelector<HTMLElement>('.ff-cp-format');
              if (!menu || !trigger) return;
              let top = 0,
                bottom = innerHeight;
              for (let node = root.parentElement; node; node = node.parentElement) {
                if (getComputedStyle(node).overflow === 'visible') continue;
                const rect = node.getBoundingClientRect();
                top = Math.max(top, rect.top);
                bottom = Math.min(bottom, rect.bottom);
              }
              const rect = trigger.getBoundingClientRect(),
                need = menu.offsetHeight + 6 + 5;
              const below = bottom - rect.bottom >= need || rect.top - top < need;
              menu.dataset.placement = below ? 'bottom-start' : 'top-start';
            });
          };
          if (root.querySelector('.ff-cp-pinned-menu')) {
            placeMenu();
            on(window, 'scroll', placeMenu, { capture: true, passive: true });
            on(window, 'resize', placeMenu);
          }

          // Swatches: one fluid hover across the grid, rows and columns alike.
          const strip = root.querySelector<HTMLElement>('.ff-cp-swatches');
          const hover = strip
            ? mountHover(strip, {
                itemSelector: '.ff-cp-swatch',
                axis: 'xy',
                radius: () => `${shapeRadius(root.dataset.radius, 12, 9999, 1)}px`,
              })
            : undefined;
          if (strip) {
            on(strip, 'mousedown', (event) => {
              if (event.button === 0) strip.setAttribute('data-pressed', '');
            });
            on(window, 'mouseup', () => strip.removeAttribute('data-pressed'));
            // Whether the pointer rests on the selected swatch, kept here
            // rather than as :has([aria-pressed]:hover): a :has() on
            // aria-pressed makes every toggle on the page restyle the page.
            let over: Element | null = null;
            const mark = () =>
              strip.toggleAttribute(
                'data-over-selected',
                over?.getAttribute('aria-pressed') === 'true',
              );
            on(strip, 'pointerover', (event) => {
              over = (event.target as Element).closest('.ff-cp-swatch');
              mark();
            });
            on(strip, 'pointerleave', () => {
              over = null;
              mark();
            });
            const selection = new MutationObserver(mark);
            selection.observe(strip, { subtree: true, attributeFilter: ['aria-pressed'] });
            cleanups.push(() => selection.disconnect());
          }
          return () => {
            cleanups.forEach((cleanup) => cleanup());
            hover?.dispose();
            cancelAnimationFrame(placeFrame);
            scrub?.cursor?.remove();
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
