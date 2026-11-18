import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { spring } from '../motion';
import { Message as GroupMessage, type Side } from './group-state';
import { Message } from './state';
type BubbleMessage = Extract<Message, { readonly _tag: 'ExitFinished' | 'GroupSidePlaced' }>;
interface Entry {
  readonly shape: HTMLElement;
  readonly label: HTMLElement;
  readonly isOpen: () => boolean;
  readonly release: () => void;
  readonly leave: () => void;
}
interface Store {
  shown: Entry | null;
  readonly dispose: Set<() => void>;
}
interface Host extends HTMLElement {
  ffTooltipGroup?: Store;
}
const storeOf = (host: Host): Store =>
  (host.ffTooltipGroup ??= { shown: null, dispose: new Set() });
const placedSide = (element: HTMLElement): Side | undefined =>
  element.closest<HTMLElement>('[data-placement]')?.dataset.placement as Side | undefined;
export const GroupMounted = Mount.defineStream('TooltipGroup.Scope', {
  args: { lifetime: Schema.Number },
  messages: [GroupMessage.SideReset],
  execute: ({ element, lifetime }) =>
    Stream.callback<typeof GroupMessage.SideReset.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const root = element as Host,
            store = storeOf(root);
          // A fresh native scope has a fresh positioning room, even if its Model was restored.
          Queue.offerUnsafe(queue, GroupMessage.SideReset({ lifetime }));
          let queued = false,
            frame = 0;
          const reset = () => {
            if (queued || root.dataset.tooltipGroupSide === 'none') return;
            queued = true;
            Queue.offerUnsafe(queue, GroupMessage.SideReset({ lifetime }));
            frame = requestAnimationFrame(() => {
              queued = false;
            });
          };
          window.addEventListener('scroll', reset, { capture: true, passive: true });
          window.addEventListener('resize', reset);
          return () => {
            window.removeEventListener('scroll', reset, { capture: true });
            window.removeEventListener('resize', reset);
            cancelAnimationFrame(frame);
            for (const dispose of [...store.dispose]) dispose();
            store.shown = null;
            if (root.ffTooltipGroup === store) delete root.ffTooltipGroup;
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});

/** Source f801409 handoff. Geometry, cloned old label and Motion controls are scoped DOM resources. */
export function mountBubble(box: HTMLElement, send: (message: BubbleMessage) => void): () => void {
  const panel = box.parentElement;
  const tree = box.getRootNode() as Document | ShadowRoot;
  // Use the containing tree, including shadow roots and other document realms.
  const host = (
    typeof tree.getElementById === 'function'
      ? tree.getElementById(box.dataset.tooltipGroupId ?? '')
      : null
  ) as Host | null;
  const shape = box.querySelector<HTMLElement>('.ff-tooltip-shape');
  const label = box.querySelector<HTMLElement>('.ff-tooltip-label');
  if (
    !panel ||
    !host ||
    !shape ||
    !label ||
    !box.isConnected ||
    host.dataset.tooltipGroupLifetime !== box.dataset.tooltipGroupLifetime
  )
    return () => {};
  const store = storeOf(host),
    reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false,
    released = false,
    run = 0,
    frame = 0;
  let previousClosing: boolean | undefined,
    version = -1;
  let hold: ReturnType<typeof setTimeout> | undefined;
  let motions: AnimationPlaybackControls[] = [];
  let previousLabel: HTMLElement | undefined;
  const value = {
    opacity: 0,
    slide: 0,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    rideX: 0,
    rideY: 0,
    label: 1,
    previous: 0,
  };
  const paint = () => {
    const side = placedSide(panel) ?? panel.dataset.side;
    box.style.opacity = String(value.opacity);
    box.style.transform = `translate${side === 'top' || side === 'bottom' ? 'Y' : 'X'}(${value.slide}px)`;
    for (const key of ['left', 'right', 'top', 'bottom'] as const)
      shape.style[key] = `${value[key]}px`;
    label.style.opacity = String(value.label);
    label.style.transform = `translate(${value.rideX}px, ${value.rideY}px)`;
    if (previousLabel) {
      previousLabel.style.opacity = String(value.previous);
      previousLabel.style.transform = `translate(-50%, -50%) translate(${value.rideX}px, ${value.rideY}px)`;
    }
  };
  const settle = () => {
    run++;
    clearTimeout(hold);
    hold = undefined;
    cancelAnimationFrame(frame);
    motions.forEach((motion) => motion.stop());
    motions = [];
  };
  const play = (
    key: keyof typeof value,
    to: number,
    transition: { type?: 'spring'; duration: number; bounce?: number },
    completed?: () => void,
  ) => {
    const generation = run;
    const motion = animate(value[key], to, {
      ...transition,
      onUpdate: (next) => {
        if (!disposed && generation === run) {
          value[key] = next;
          paint();
        }
      },
    });
    motions.push(motion);
    if (completed)
      motion.finished.then(() => {
        if (!disposed && generation === run) completed();
      });
  };
  const finish = () => {
    if (!disposed && panel.dataset.closing === 'true')
      send(Message.ExitFinished({ version: Number(panel.dataset.tooltipVersion) }));
  };
  const exit = () => {
    if (store.shown === entry) store.shown = null;
    play('opacity', 0, spring.fast.exit, finish);
  };
  const enter = () => {
    previousLabel?.remove();
    previousLabel = undefined;
    // Source entrance uses the requested side; resolved placement gates handoff.
    const side = panel.dataset.side ?? placedSide(panel);
    for (const key of ['left', 'right', 'top', 'bottom', 'rideX', 'rideY'] as const) value[key] = 0;
    value.label = 1;
    value.previous = 0;
    value.slide = reduce.matches ? 0 : side === 'top' || side === 'left' ? 4 : -4;
    paint();
    play('slide', 0, spring.fast);
    play('opacity', 1, spring.fast);
  };
  const entry: Entry = {
    shape,
    label,
    isOpen: () => panel.dataset.closing === 'false',
    release: () => {
      settle();
      released = true;
      value.opacity = 0;
      paint();
      finish();
    },
    leave: () => {
      settle();
      exit();
    },
  };
  const glide = (from: Entry) => {
    const a = from.shape.getBoundingClientRect();
    const clone = from.label.cloneNode(true) as HTMLElement;
    // This is an aria-hidden, pointerless visual copy, never a second logical tooltip.
    for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('*')])
      node.removeAttribute('id');
    clone.setAttribute('aria-hidden', 'true');
    clone.classList.add('ff-tooltip-previous');
    from.release();
    const b = box.getBoundingClientRect(),
      scale = b.width / box.offsetWidth || 1;
    previousLabel?.remove();
    previousLabel = clone;
    box.append(clone);
    const offsets = {
      left: (a.left - b.left) / scale,
      right: (b.right - a.right) / scale,
      top: (a.top - b.top) / scale,
      bottom: (b.bottom - a.bottom) / scale,
      rideX: (a.left + a.right - b.left - b.right) / 2 / scale,
      rideY: (a.top + a.bottom - b.top - b.bottom) / 2 / scale,
    };
    for (const key of ['left', 'right', 'top', 'bottom', 'rideX', 'rideY'] as const) {
      value[key] = reduce.matches ? 0 : offsets[key];
      if (!reduce.matches) play(key, 0, spring.fast);
    }
    value.slide = 0;
    value.opacity = 1;
    value.label = 0;
    value.previous = 1;
    paint();
    play('label', 1, spring.fast);
    play('previous', 0, spring.fast.exit, () => {
      previousLabel?.remove();
      previousLabel = undefined;
    });
  };
  const sync = () => {
    const closing = panel.dataset.closing === 'true',
      nextVersion = Number(panel.dataset.tooltipVersion);
    if (previousClosing === closing && version === nextVersion) return;
    previousClosing = closing;
    version = nextVersion;
    settle();
    if (closing) {
      if (released) return;
      if (store.shown !== entry) exit();
      else hold = setTimeout(exit, 150);
      return;
    }
    released = false;
    if (store.shown === entry) {
      play('slide', 0, spring.fast);
      play('opacity', 1, spring.fast);
      return;
    }
    value.opacity = 0;
    paint();
    const generation = run,
      sideVersion = Number(box.dataset.tooltipGroupSideVersion);
    const placed = () => {
      if (disposed || generation !== run) return;
      const side = placedSide(panel);
      if (!side || !box.offsetWidth) {
        frame = requestAnimationFrame(placed);
        return;
      }
      const from = store.shown;
      store.shown = entry;
      send(Message.GroupSidePlaced({ side, sideVersion }));
      if (!from || from === entry || from.isOpen() || !from.shape.isConnected) enter();
      else if (placedSide(from.shape) === side) glide(from);
      else {
        from.leave();
        enter();
      }
    };
    frame = requestAnimationFrame(placed);
  };
  const observer = new MutationObserver(sync);
  observer.observe(panel, {
    attributes: true,
    attributeFilter: ['data-closing', 'data-tooltip-version'],
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    settle();
    observer.disconnect();
    previousLabel?.remove();
    if (store.shown === entry) store.shown = null;
    store.dispose.delete(dispose);
  };
  store.dispose.add(dispose);
  paint();
  sync();
  return dispose;
}
export const GroupMotion = Mount.defineStream('TooltipGroup.Bubble', {
  messages: [Message.ExitFinished, Message.GroupSidePlaced],
  execute: ({ element }) =>
    Stream.callback<BubbleMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          element instanceof HTMLElement
            ? mountBubble(element, (message) => Queue.offerUnsafe(queue, message))
            : () => {},
        ),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
