import { defineSilentMount } from '../silent-mount';
import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { Message, type FocusOwner } from './state';
export interface Host extends FocusOwner {
  ffContextFilter?: (target: Element, triggerId: string) => boolean;
}
const editable = 'input,textarea,select,[contenteditable]:not([contenteditable=false])';
/** The owner sits outside the triggers, so their own handlers run first.
 * Nested owners claim a native event by preventing its default. */
export function mountContextMenu(
  root: Host,
  lifetime: number,
  send: (message: typeof Message.Requested.Type) => void,
): () => void {
  const triggerFor = (target: Element) => {
    for (
      let node: Element | null = target;
      node && root.contains(node);
      node = node.parentElement
    ) {
      if (
        node.hasAttribute('data-context-menu-trigger') &&
        node.closest('[data-context-menu-root]') === root
      )
        return node as HTMLElement;
    }
    return undefined;
  };
  const open = (event: MouseEvent | KeyboardEvent) => {
    if (
      event instanceof KeyboardEvent &&
      event.key !== 'ContextMenu' &&
      !(event.shiftKey && event.key === 'F10')
    )
      return;
    const target = event.target;
    if (
      event.defaultPrevented ||
      !(target instanceof Element) ||
      target.closest(editable) ||
      root.dataset.contextDisabled === 'true'
    )
      return;
    const trigger = triggerFor(target);
    if (!trigger || trigger.dataset.contextDisabled === 'true') return;
    const id = trigger.dataset.contextMenuTrigger!;
    if (root.ffContextFilter && !root.ffContextFilter(target, id)) return;
    const keyboard = event instanceof KeyboardEvent;
    if (keyboard && event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
    event.preventDefault();
    const active = document.activeElement;
    root.ffContextReturnTo =
      active instanceof HTMLElement && active !== document.body ? active : trigger;
    const rect = keyboard ? target.getBoundingClientRect() : undefined;
    const targetValue = target.closest('[data-context-value]')?.getAttribute('data-context-value');
    send(
      Message.Requested({
        triggerId: id,
        x: rect ? rect.left + 8 : (event as MouseEvent).clientX,
        y: rect ? rect.bottom : (event as MouseEvent).clientY,
        ...(targetValue === null || targetValue === undefined ? {} : { targetValue }),
        lifetime,
      }),
    );
  };
  root.addEventListener('contextmenu', open);
  root.addEventListener('keydown', open);
  return () => {
    root.removeEventListener('contextmenu', open);
    root.removeEventListener('keydown', open);
    root.ffContextReturnTo = undefined;
  };
}
export const Mounted = Mount.defineStream('ContextMenu.Triggers', {
  args: { lifetime: Schema.Number },
  messages: [Message.Requested],
  execute: ({ element, lifetime }) =>
    Stream.callback<typeof Message.Requested.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          element instanceof HTMLElement
            ? mountContextMenu(element, lifetime, (message) => Queue.offerUnsafe(queue, message))
            : () => {},
        ),
        (dispose) => Effect.sync(dispose),
      ),
    ),
});
/** The zero-size native trigger leaves scaled/scrolling ancestors, as upstream. */
export const AnchorPortal = defineSilentMount('ContextMenu.AnchorPortal', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const placeholder = document.createComment('context-menu-anchor');
        element.before(placeholder);
        document.body.append(element);
        return () => {
          element.remove();
          placeholder.remove();
        };
      }),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
