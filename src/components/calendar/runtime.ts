import { shapeRadius } from '../shape';
import { Effect, Option, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { CalendarDateFromIsoString } from 'foldkit/calendar';
import { animate, type AnimationPlaybackControls } from 'motion';
import { mountHover, type HoverEngine } from '../../fluid-hover/engine';
import { Message } from './state';
import { gridKeys } from './focus';
import { mountMonthMotion } from './month-motion';
import '../../fluid-hover/styles.css';
export const requiredWidth = (cell: number, weekNumbers: boolean): number =>
  (7 + (weekNumbers ? 0.75 : 0)) * cell * 2 + 24 + 16;
export const Mounted = Mount.defineStream('Calendar.Interactions', {
  messages: [
    Message.Hovered,
    Message.Focused,
    Message.Left,
    Message.PointerInput,
    Message.LayoutChanged,
    Message.Cancel,
  ],
  execute: ({ element }) =>
    Stream.callback<InteractionMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          return element instanceof HTMLElement
            ? mountInteractions(element, (message) => Queue.offerUnsafe(queue, message))
            : () => {};
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
/** DOM projection shared by the scoped mount and interaction-seam checks. */
export function mountInteractions(
  root: HTMLElement,
  send: (message: InteractionMessage) => void,
): () => void {
  const months = root.querySelector<HTMLElement>('.ff-calendar-months'),
    layers = root.querySelector<HTMLElement>('.ff-calendar-hover-layers');
  if (!months || !layers) return () => {};
  const disposeMonths = mountMonthMotion(root);
  const reduce = matchMedia('(prefers-reduced-motion:reduce)');
  let keyboard =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches(':focus-visible'),
    autoFocusPending = root.dataset.autoFocus === 'true',
    pressed = false,
    active: HTMLElement | undefined,
    wasVisible = false,
    pendingOrigin = false,
    lastHover = '',
    lastMonth = root.dataset.viewMonth,
    layoutRequest = '';
  let hover: HoverEngine | undefined;
  const fill = document.createElement('div'),
    outline = document.createElement('div'),
    focusRing = document.createElement('div');
  fill.className = 'ff-calendar-hover-fill';
  outline.className = 'ff-calendar-hover-outline';
  focusRing.className = 'ff-calendar-focus-ring';
  fill.hidden = true;
  outline.hidden = true;
  focusRing.hidden = true;
  for (const layer of [fill, outline, focusRing]) layer.style.opacity = '0';
  layers.append(fill, outline, focusRing);
  const motions = new Map<HTMLElement, AnimationPlaybackControls>();
  const fadeMotions = new Map<HTMLElement, AnimationPlaybackControls>();
  const geometry = (item: HTMLElement, pad = 0) => {
    let left = item.offsetLeft,
      top = item.offsetTop,
      parent = item.offsetParent;
    while (parent instanceof HTMLElement && parent !== months && months.contains(parent)) {
      left += parent.offsetLeft + parent.clientLeft;
      top += parent.offsetTop + parent.clientTop;
      parent = parent.offsetParent;
    }
    return {
      x: left - pad,
      y: top - pad,
      width: item.offsetWidth + pad * 2,
      height: item.offsetHeight + pad * 2,
    };
  };
  const position = (layer: HTMLElement, item: HTMLElement, pad = 0, snap = false) => {
    const rect = geometry(item, pad);
    motions.get(layer)?.stop();
    if (layer.hidden || reduce.matches || snap) {
      Object.assign(layer.style, {
        transform: `translate(${rect.x}px,${rect.y}px)`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
      layer.hidden = false;
    } else motions.set(layer, animate(layer, rect, { type: 'spring', duration: 0.08, bounce: 0 }));
  };
  const fade = (layer: HTMLElement, value: number) => {
    fadeMotions.get(layer)?.stop();
    const animation = animate(
      layer,
      { opacity: value },
      {
        duration: value ? 0.08 : 0.06,
        onComplete: () => {
          if (fadeMotions.get(layer) !== animation) return;
          fadeMotions.delete(layer);
          if (value === 0) layer.hidden = true;
        },
      },
    );
    fadeMotions.set(layer, animation);
  };
  const dateFor = (item: HTMLElement) =>
    Schema.decodeUnknownOption(CalendarDateFromIsoString)(item.dataset.date);
  const paintActive = (snap = false) => {
    if (!active || !root.contains(active)) {
      if (wasVisible) {
        fade(fill, 0);
        fade(outline, 0);
        wasVisible = false;
      }
      return;
    }
    if (pendingOrigin && root.dataset.hovered !== active.dataset.date) return;
    const solid = active.dataset.previewEnd === 'true',
      filled = solid || active.dataset.selected === 'true';
    fill.dataset.solid = String(solid);
    fill.dataset.filled = String(filled);
    outline.dataset.filled = String(filled);
    fill.dataset.pressed = String(pressed);
    outline.dataset.pressed = String(pressed);
    if (pendingOrigin && solid && !snap) {
      const origin = root.querySelector<HTMLElement>(
        `.ff-calendar-day[data-calendar-index][data-date="${root.dataset.rangeStart}"]`,
      );
      if (origin)
        for (const layer of [fill, outline]) {
          position(layer, origin, 0, true);
          fadeMotions.get(layer)?.stop();
          fadeMotions.delete(layer);
          layer.style.opacity = '1';
        }
    }
    pendingOrigin = false;
    position(fill, active, 0, snap);
    position(outline, active, 0, snap);
    fade(fill, 1);
    fade(outline, 1);
    wasVisible = true;
  };
  const pick = (index: number | null) => {
    active = index === null ? undefined : hover?.items[index];
    const raw = active?.dataset.date ?? '';
    if (!wasVisible) pendingOrigin = !!active && root.dataset.picking === 'true';
    if (raw !== lastHover) {
      lastHover = raw;
      send(Message.Hovered({ date: active ? dateFor(active) : Option.none() }));
    }
    paintActive();
  };
  hover = mountHover(months, {
    itemSelector: '.ff-calendar-day[data-calendar-index]',
    ownsItem: (item) => !item.closest('[data-calendar-outgoing]'),
    renderHighlight: false,
    axis: 'xy',
    nearest: false,
    keyboardNavigation: false,
    followLayout: true,
    onPick: pick,
  });
  const navs = new Map<HTMLElement, HoverEngine>();
  const syncNav = () => {
    for (const [node, engine] of navs)
      if (!root.contains(node)) {
        engine.dispose();
        navs.delete(node);
      }
    root.querySelectorAll<HTMLElement>('.ff-calendar-nav').forEach((node) => {
      if (!navs.has(node))
        navs.set(
          node,
          mountHover(node, {
            itemSelector: 'button',
            nearest: false,
            axis: 'x',
            keyboardNavigation: false,
            radius: () => `${shapeRadius(root.dataset.radius, 8, 20, 1)}px`,
          }),
        );
    });
  };
  const paintFocus = () => {
    const focused = root.querySelector<HTMLElement>('.ff-calendar-day:focus');
    if (!focused || root.dataset.keyboard !== 'true') {
      fade(focusRing, 0);
      return;
    }
    position(focusRing, focused, 2, root.dataset.viewMonth !== lastMonth);
    fade(focusRing, 1);
  };
  const layout = () => {
    if (root.dataset.numberMonths !== '2' || root.dataset.orientation !== 'auto') return;
    const parent = root.parentElement;
    if (!parent) return;
    const style = getComputedStyle(parent),
      width =
        parent.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0),
      cell = parseFloat(getComputedStyle(root).getPropertyValue('--cell-size'));
    const value =
      width >= requiredWidth(cell, root.dataset.weekNumbers === 'true') ? 'horizontal' : 'vertical';
    if (value !== root.dataset.layout && value !== layoutRequest) {
      layoutRequest = value;
      send(Message.LayoutChanged({ layout: value }));
    } else if (value === root.dataset.layout) layoutRequest = '';
  };
  const sync = () => {
    layout();
    syncNav();
    const col = root.querySelector<HTMLElement>('.ff-calendar-cell')?.offsetWidth;
    if (col && root.style.getPropertyValue('--calendar-col') !== `${col}px`)
      root.style.setProperty('--calendar-col', `${col}px`);
    const changed = root.dataset.viewMonth !== lastMonth;
    if (changed) {
      active = undefined;
      hover?.leave();
    }
    hover?.measure();
    // FocusDay can run before this observer sees the committed month. Retain
    // that live focus after clearing the departing panel's pointer session.
    if (changed) {
      const focused = root.querySelector<HTMLElement>(
        '.ff-calendar-day[data-calendar-index]:focus',
      );
      if (focused) {
        active = focused;
        pendingOrigin = false;
        lastHover = focused.dataset.date ?? '';
        send(Message.Hovered({ date: dateFor(focused) }));
      }
    }
    paintActive(changed);
    paintFocus();
    lastMonth = root.dataset.viewMonth;
  };
  const focus = (event: FocusEvent) => {
    if (
      !(event.target instanceof HTMLElement) ||
      !event.target.matches('.ff-calendar-day[data-calendar-index]')
    )
      return;
    const date = dateFor(event.target);
    if (Option.isNone(date)) return;
    const visible = keyboard || (!autoFocusPending && event.target.matches(':focus-visible'));
    autoFocusPending = false;
    send(Message.Focused({ date: date.value, keyboard: visible }));
  };
  const blur = (event: FocusEvent) => {
    if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
      send(Message.Left());
      fade(focusRing, 0);
    }
  };
  const down = () => {
    keyboard = false;
    pressed = true;
    send(Message.PointerInput());
    paintActive();
    fade(focusRing, 0);
  };
  const up = () => {
    pressed = false;
    paintActive();
  };
  const move = (event: MouseEvent) => {
    if (event.target instanceof Element && event.target.closest('[data-calendar-inert]'))
      hover?.leave();
    if (keyboard) {
      keyboard = false;
      send(Message.PointerInput());
      fade(focusRing, 0);
    }
  };
  const keyCapture = (event: KeyboardEvent) => {
    if (event.key === 'Tab' || gridKeys.some((key) => key === event.key)) keyboard = true;
    if (
      event.key === 'Escape' &&
      root.contains(event.target as Node) &&
      root.dataset.picking === 'true'
    ) {
      event.preventDefault();
      event.stopPropagation();
      send(Message.Cancel());
    }
  };
  const keyBubble = (event: KeyboardEvent) => {
    if (
      gridKeys.some((key) => key === event.key) &&
      event.target instanceof HTMLElement &&
      event.target.matches('.ff-calendar-day')
    )
      event.stopPropagation();
  };
  const resize = new ResizeObserver(sync);
  resize.observe(root);
  if (root.parentElement) resize.observe(root.parentElement);
  const observer = new MutationObserver(sync);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'data-view-month',
      'data-size',
      'data-cell-size',
      'data-radius',
      'data-number-months',
      'data-orientation',
      'data-layout',
      'data-fill',
      'data-week-numbers',
      'data-picking',
      'data-keyboard',
      'data-range-start',
      'data-hovered',
      'data-band-from',
      'data-band-to',
      'data-commit-end',
      'data-preview-end',
      'data-selected',
    ],
  });
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', blur);
  root.addEventListener('mousedown', down);
  root.addEventListener('mousemove', move, true);
  root.addEventListener('keydown', keyBubble);
  window.addEventListener('mouseup', up);
  window.addEventListener('keydown', keyCapture, true);
  reduce.addEventListener('change', sync);
  sync();
  if (autoFocusPending) root.querySelector<HTMLElement>('.ff-calendar-day[tabindex="0"]')?.focus();
  return () => {
    disposeMonths();
    resize.disconnect();
    observer.disconnect();
    hover?.dispose();
    for (const engine of navs.values()) engine.dispose();
    for (const motion of motions.values()) motion.stop();
    for (const motion of fadeMotions.values()) motion.stop();
    root.removeEventListener('focusin', focus);
    root.removeEventListener('focusout', blur);
    root.removeEventListener('mousedown', down);
    root.removeEventListener('mousemove', move, true);
    root.removeEventListener('keydown', keyBubble);
    window.removeEventListener('mouseup', up);
    window.removeEventListener('keydown', keyCapture, true);
    reduce.removeEventListener('change', sync);
    fill.remove();
    outline.remove();
    focusRing.remove();
  };
}
type InteractionMessage = Extract<
  Message,
  {
    _tag: 'Hovered' | 'Focused' | 'Left' | 'PointerInput' | 'LayoutChanged' | 'Cancel';
  }
>;
