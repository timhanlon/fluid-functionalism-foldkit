import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { mountHover } from '../../fluid-hover/engine';
import { Message } from './state';
export const Mounted = Mount.defineStream('DatePicker.Field', {
  messages: [
    Message.Ready,
    Message.ClearObserved,
    Message.Acknowledged,
    Message.Viewport,
    Message.SyncOpen,
    Message.Clock,
    Message.RowsChanged,
    Message.TimeModeChanged,
  ],
  execute: ({ element }) =>
    Stream.callback<
      Extract<
        Message,
        {
          _tag:
            | 'Acknowledged'
            | 'Viewport'
            | 'SyncOpen'
            | 'Clock'
            | 'RowsChanged'
            | 'TimeModeChanged'
            | 'Ready'
            | 'ClearObserved';
        }
      >
    >((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          return element instanceof HTMLElement
            ? mountField(element, (message) => Queue.offerUnsafe(queue, message))
            : () => {};
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
type FieldMessage = Extract<
  Message,
  {
    _tag:
      | 'Acknowledged'
      | 'Viewport'
      | 'SyncOpen'
      | 'Clock'
      | 'RowsChanged'
      | 'TimeModeChanged'
      | 'Ready'
      | 'ClearObserved';
  }
>;
export function mountField(root: HTMLElement, send: (message: FieldMessage) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined,
    lastAck = '',
    lastExternal = '',
    lastMode = '',
    rowWidth = 0,
    lastRows = '',
    lastClear = '';
  const hover = mountHover(root, {
    itemSelector: '[data-datepicker-segment]',
    ownsItem: (node) => node.closest('.ff-date-picker') === root,
    axis: 'xy',
    nearest: false,
    keyboardNavigation: false,
    radius: () =>
      root.dataset.radius === 'sharp'
        ? '1px'
        : root.dataset.radius === 'pill'
          ? root.dataset.variant === 'outline'
            ? '17px'
            : '20px'
          : root.dataset.variant === 'outline'
            ? '5px'
            : '8px',
  });
  const measureRows = () => {
    const timed = root.dataset.timeKind !== undefined && root.dataset.timeKind !== 'none',
      parent = root.parentElement;
    if (!timed || !parent) {
      if (root.dataset.twoRows === 'true') send(Message.RowsChanged({ twoRows: false }));
      rowWidth = 0;
      return;
    }
    if (root.dataset.twoRows !== 'true')
      rowWidth = root.scrollWidth + root.offsetWidth - root.clientWidth;
    const style = getComputedStyle(parent),
      room =
        parent.clientWidth -
        (parseFloat(style.paddingLeft) || 0) -
        (parseFloat(style.paddingRight) || 0),
      twoRows = rowWidth > room + 0.5;
    if (String(twoRows) !== root.dataset.twoRows && String(twoRows) !== lastRows) {
      lastRows = String(twoRows);
      send(Message.RowsChanged({ twoRows }));
    } else if (String(twoRows) === root.dataset.twoRows) lastRows = '';
  };
  const sync = () => {
    const generation = root.dataset.ackGeneration ?? '',
      pending = root.dataset.ackPending === 'true',
      ack = pending ? generation : '';
    if (ack !== lastAck) {
      clearTimeout(timer);
      lastAck = ack;
      if (pending)
        timer = setTimeout(
          () => send(Message.Acknowledged({ generation: Number(generation) })),
          200,
        );
    }
    const mode = root.dataset.timeKind ?? 'none';
    if (mode !== lastMode) {
      lastMode = mode;
      rowWidth = 0;
      send(
        Message.TimeModeChanged({
          mode: mode === 'time' ? 'time' : mode === 'range' ? 'range' : 'none',
        }),
      );
    }
    measureRows();
    const show = root.dataset.clearWanted ?? 'false';
    if (show !== lastClear) {
      lastClear = show;
      send(Message.ClearObserved({ show: show === 'true' }));
    }
    const external = root.dataset.externalOpen ?? '';
    if (external !== lastExternal) {
      lastExternal = external;
      if (external) send(Message.SyncOpen({ open: external === 'true' }));
    }
  };
  const clock = () => {
    const now = new Date();
    send(Message.Clock({ minutes: now.getHours() * 60 + now.getMinutes() }));
  };
  const resized = () => {
    send(Message.Viewport({ width: window.innerWidth }));
    measureRows();
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, {
    attributes: true,
    attributeFilter: [
      'data-ack-generation',
      'data-ack-pending',
      'data-external-open',
      'data-time-kind',
      'data-two-rows',
      'data-size',
      'data-clear-wanted',
    ],
  });
  const sizing = new ResizeObserver(measureRows);
  sizing.observe(root);
  if (root.parentElement) sizing.observe(root.parentElement);
  sync();
  send(Message.Ready());
  resized();
  clock();
  root.addEventListener('focus', clock, true);
  window.addEventListener('resize', resized);
  return () => {
    clearTimeout(timer);
    observer.disconnect();
    sizing.disconnect();
    root.removeEventListener('focus', clock, true);
    hover.dispose();
    window.removeEventListener('resize', resized);
  };
}
export const PanelMounted = Mount.define('DatePicker.Panel', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const panel = element.closest<HTMLElement>('.ff-date-picker-popup');
        if (!panel) return () => {};
        const size = () => {
          const available = panel.style.maxHeight || '560px';
          if (panel.style.getPropertyValue('--date-picker-available-height') !== available)
            panel.style.setProperty('--date-picker-available-height', available);
        };
        const sizing = new MutationObserver(size);
        sizing.observe(panel, { attributes: true, attributeFilter: ['style'] });
        size();
        const presets = element.querySelector<HTMLElement>('[data-slot="date-picker-presets"]');
        const hover = presets
          ? mountHover(presets, {
              itemSelector: 'button',
              axis: 'xy',
              nearest: false,
              keyboardNavigation: false,
              radius: () => '8px',
            })
          : undefined;
        return () => {
          sizing.disconnect();
          hover?.dispose();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
