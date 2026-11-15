import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { Message } from './tree-state';

type RuntimeMessage = Extract<Message, { readonly _tag: 'OpenedSubmenu' | 'ClosedSubmenu' }>;

/** Connect flat Menu instances into a nested product menu. Each Menu retains
 * its own navigation, typeahead, positioning and dismissal behavior. */
export const TreeMounted = Mount.defineStream('Dropdown.Tree', {
  args: { id: Schema.String },
  messages: [Message.OpenedSubmenu, Message.ClosedSubmenu],
  execute: ({ element, id }) =>
    Stream.callback<RuntimeMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const document = element.ownerDocument;
          const owned = (target: EventTarget | null): HTMLElement | undefined => {
            const panel =
              target instanceof Element ? target.closest<HTMLElement>('[data-menu-tree]') : null;
            return panel?.dataset.menuTree === id && !panel.hasAttribute('data-leave')
              ? panel
              : undefined;
          };
          const pathOf = (panel: HTMLElement) =>
            panel.dataset.menuPath?.split('.').filter(Boolean).map(Number) ?? [];
          const emit = (message: RuntimeMessage) => Queue.offerUnsafe(queue, message);
          const move = (event: PointerEvent) => {
            if (event.pointerType === 'touch') return;
            const panel = owned(event.target);
            const row =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>('[data-submenu-trigger]')
                : null;
            if (
              !panel ||
              !row ||
              row.closest('[data-menu-tree]') !== panel ||
              row.getAttribute('aria-disabled') === 'true'
            )
              return;
            const index = Number(row.dataset.dropdownIndex);
            if (panel.dataset.heldIndex !== String(index))
              emit(Message.OpenedSubmenu({ path: pathOf(panel), index, keyboard: false }));
          };
          const key = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const panel = owned(event.target);
            if (!panel) return;
            const path = pathOf(panel),
              rtl = panel.dataset.direction === 'rtl';
            if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') && path.length) {
              event.preventDefault();
              event.stopPropagation();
              emit(Message.ClosedSubmenu({ path }));
            } else if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) {
              const row = panel.querySelector<HTMLElement>('[data-active][data-submenu-trigger]');
              if (!row) return;
              event.preventDefault();
              event.stopPropagation();
              emit(
                Message.OpenedSubmenu({
                  path,
                  index: Number(row.dataset.dropdownIndex),
                  keyboard: true,
                }),
              );
            }
          };
          const blur = (event: FocusEvent) => {
            if (owned(event.target) && owned(event.relatedTarget)) event.stopImmediatePropagation();
          };
          const leave = (event: PointerEvent) => {
            if (owned(event.target) && owned(event.relatedTarget)) event.stopImmediatePropagation();
          };
          document.addEventListener('pointermove', move, true);
          document.addEventListener('keydown', key, true);
          document.addEventListener('blur', blur, true);
          document.addEventListener('pointerleave', leave, true);
          return () => {
            document.removeEventListener('pointermove', move, true);
            document.removeEventListener('keydown', key, true);
            document.removeEventListener('blur', blur, true);
            document.removeEventListener('pointerleave', leave, true);
          };
        }),
        (dispose) => Effect.sync(dispose),
      ),
    ),
});
