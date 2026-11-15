import { Effect, Option, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { anchorSetup } from '@foldkit/ui/anchor';
import { animate, type AnimationPlaybackControls } from 'motion';
import { mountHover } from '../../fluid-hover/engine';
import { Message } from './time-field-model';
import * as Edit from './time-field-state';
export const Anchored = Mount.define('DatePicker.TimeAnchor', {
  args: { anchorId: Schema.String },
  messages: [Message.Noop],
  execute: ({ element, anchorId }) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        anchorSetup(element, {
          buttonId: anchorId,
          anchor: { placement: 'bottom-start', gap: 6, padding: 8, portal: true },
          interceptTab: false,
          focusAfterPosition: false,
        }),
      ),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.as(Message.Noop())),
});
export const FieldMounted = Mount.defineStream('DatePicker.TimeInput', {
  args: { listId: Schema.String },
  messages: [Message.Edit],
  execute: ({ element, listId }) =>
    Stream.callback<typeof Message.Edit.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const input = element.querySelector('input');
          if (!input) return () => {};
          const selected = () => input.select();
          const click = (event: MouseEvent) => {
            if (event.target !== input) input.focus();
          };
          const blur = (event: FocusEvent) => {
            if (event.target === input)
              Queue.offerUnsafe(
                queue,
                Message.Edit({
                  message: Edit.Message.Blurred({
                    insideList:
                      event.relatedTarget instanceof Node &&
                      !!document.getElementById(listId)?.contains(event.relatedTarget),
                  }),
                }),
              );
          };
          const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && element.dataset.editing === 'true')
              event.stopPropagation();
          };
          input.addEventListener('focus', selected);
          element.addEventListener('click', click);
          element.addEventListener('focusout', blur);
          element.addEventListener('keydown', key);
          return () => {
            input.removeEventListener('focus', selected);
            element.removeEventListener('click', click);
            element.removeEventListener('focusout', blur);
            element.removeEventListener('keydown', key);
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
export const ListMounted = Mount.defineStream('DatePicker.TimeSlots', {
  args: { anchorId: Schema.String },
  messages: [Message.Edit],
  execute: ({ element, anchorId }) =>
    Stream.callback<typeof Message.Edit.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          element instanceof HTMLElement
            ? mountTimeList(element, anchorId, (message) =>
                Queue.offerUnsafe(queue, Message.Edit({ message })),
              )
            : () => {},
        ),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
/** One list session owns its highlight, retrying scroll request and outside
 * listeners. The editable input remains the focus owner throughout. */
export function mountTimeList(
  list: HTMLElement,
  anchorId: string,
  send: (message: Edit.Message) => void,
): () => void {
  const popup = list.closest<HTMLElement>('.ff-time-popup'),
    viewport = list.closest<HTMLElement>('[data-slot="scroll-area-viewport"]');
  if (!popup || !viewport) return () => {};
  const reduce = matchMedia('(prefers-reduced-motion:reduce)'),
    layer = document.createElement('div');
  layer.className = 'ff-time-hover';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  layer.style.opacity = '0';
  list.prepend(layer);
  let travel: AnimationPlaybackControls | undefined,
    fade: AnimationPlaybackControls | undefined,
    lastPick: number | null | undefined,
    frame = 0,
    lastScroll = '',
    tries = 0,
    visible = false;
  const open = () => popup.dataset.open === 'true';
  const rows = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const paint = () => {
    const index = Number(list.dataset.activeIndex),
      row = list.dataset.activeIndex !== '' ? rows()[index] : undefined;
    travel?.stop();
    fade?.stop();
    if (!row || !open()) {
      visible = false;
      fade = animate(
        layer,
        { opacity: 0 },
        {
          duration: 0.06,
          onComplete: () => {
            if (!visible) layer.hidden = true;
          },
        },
      );
      return;
    }
    const geometry = {
      x: row.offsetLeft,
      y: row.offsetTop,
      width: row.offsetWidth,
      height: row.offsetHeight,
    };
    if (layer.hidden || reduce.matches) {
      Object.assign(layer.style, {
        transform: `translate(${geometry.x}px,${geometry.y}px)`,
        width: `${geometry.width}px`,
        height: `${geometry.height}px`,
      });
      layer.hidden = false;
    } else travel = animate(layer, geometry, { type: 'spring', duration: 0.08, bounce: 0 });
    visible = true;
    fade = animate(layer, { opacity: 1 }, { duration: 0.08 });
  };
  const scroll = () => {
    frame = 0;
    if (!open()) return;
    const center = list.dataset.scrollCenter === 'true',
      items = rows(),
      active = Number(list.dataset.activeIndex),
      target = Number(list.dataset.openTarget),
      selected = items.find((row) => row.getAttribute('aria-selected') === 'true');
    const row = center
      ? (selected ??
        (list.dataset.openTarget !== '' ? items[target] : undefined) ??
        (list.dataset.activeIndex !== '' ? items[active] : undefined))
      : list.dataset.activeIndex !== ''
        ? items[active]
        : undefined;
    if (!row || viewport.clientHeight === 0) {
      if (++tries <= 30) frame = requestAnimationFrame(scroll);
      return;
    }
    const top = row.offsetTop,
      bottom = top + row.offsetHeight;
    if (center) viewport.scrollTop = top - viewport.clientHeight / 2 + row.offsetHeight / 2;
    else if (top < viewport.scrollTop) viewport.scrollTop = top - 4;
    else if (bottom > viewport.scrollTop + viewport.clientHeight)
      viewport.scrollTop = bottom - viewport.clientHeight + 4;
  };
  const sync = () => {
    paint();
    const generation = list.dataset.scrollGeneration ?? '';
    if (generation !== lastScroll) {
      lastScroll = generation;
      cancelAnimationFrame(frame);
      tries = 0;
      frame = requestAnimationFrame(scroll);
    }
  };
  const hover = mountHover(list, {
    itemSelector: '[role="option"]',
    renderHighlight: false,
    axis: 'y',
    nearest: true,
    keyboardNavigation: false,
    enabled: open,
    onPick: (index) => {
      if (index !== lastPick) {
        lastPick = index;
        send(Edit.Message.Hovered({ index: index === null ? Option.none() : Option.some(index) }));
      }
    },
  });
  const down = (event: MouseEvent) => event.preventDefault();
  const gap = (event: MouseEvent) => {
    if (
      event.target instanceof Element &&
      !event.target.closest('[role="option"]') &&
      hover.active !== null &&
      open()
    )
      send(Edit.Message.Picked({ index: hover.active }));
  };
  const outside = (event: Event) => {
    if (!open() || !(event.target instanceof Node)) return;
    const anchor = document.getElementById(anchorId);
    if (!popup.contains(event.target) && !anchor?.contains(event.target))
      send(Edit.Message.Closed());
  };
  const cap = () => {
    const available = parseFloat(popup.style.maxHeight) || 240,
      value = `${Math.min(240, available)}px`;
    if (popup.style.getPropertyValue('--time-list-height') !== value)
      popup.style.setProperty('--time-list-height', value);
  };
  const popupObserver = new MutationObserver(() => {
    cap();
    sync();
  });
  popupObserver.observe(popup, { attributes: true, attributeFilter: ['style', 'data-open'] });
  cap();
  const observer = new MutationObserver(sync);
  observer.observe(list, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-active-index',
      'data-scroll-generation',
      'data-scroll-center',
      'aria-selected',
    ],
  });
  const resize = new ResizeObserver(paint);
  resize.observe(viewport);
  resize.observe(list);
  list.addEventListener('mousedown', down);
  list.addEventListener('click', gap);
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('focusin', outside, true);
  reduce.addEventListener('change', paint);
  sync();
  return () => {
    observer.disconnect();
    popupObserver.disconnect();
    resize.disconnect();
    hover.dispose();
    travel?.stop();
    fade?.stop();
    cancelAnimationFrame(frame);
    layer.remove();
    list.removeEventListener('mousedown', down);
    list.removeEventListener('click', gap);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('focusin', outside, true);
    reduce.removeEventListener('change', paint);
  };
}
