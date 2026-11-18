import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { Message } from './search-state';
import { mountSearchSpace } from './search-space';

/** Connect an editable header to a flat Foldkit Menu. Once entered, the
 * primitive owns row navigation, typeahead, dismissal and focus return. */
export const SearchMounted = Mount.defineStream('Dropdown.Search', {
  messages: [Message.SearchFocused, Message.NavigatedToRow],
  execute: ({ element }) =>
    Stream.callback<typeof Message.SearchFocused.Type | typeof Message.NavigatedToRow.Type>(
      (queue) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            if (!(element instanceof HTMLInputElement)) return () => {};
            const input = element;
            const popup = input.closest<HTMLElement>('[role="menu"]');
            if (!popup) return () => {};
            const disposeSpace = mountSearchSpace(input);
            let initialFocus = true;
            const focused = () => {
              initialFocus = false;
              Queue.offerUnsafe(queue, Message.SearchFocused({}));
            };
            // AnchorMenu focuses its panel after positioning reveals it.
            // Hand that first focus to the composed editable header, then
            // leave later FocusItems commands to Menu's row navigation.
            const entered = (event?: FocusEvent) => {
              if (initialFocus && (!event || event.target === popup))
                input.focus({ preventScroll: true });
            };
            const key = (event: KeyboardEvent) => {
              if (event.defaultPrevented) return;
              if (event.isComposing || event.keyCode === 229) {
                event.stopPropagation();
                return;
              }
              if (event.key === 'Escape' || event.key === 'Tab') return;
              // Editing the search field must not invoke Menu's printable-key handler.
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.preventDefault();
                return;
              }
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
              const rows = [...popup.querySelectorAll<HTMLElement>('[data-dropdown-index]')].filter(
                (row) => row.getAttribute('aria-disabled') !== 'true',
              );
              const row = event.key === 'ArrowDown' ? rows[0] : rows.at(-1);
              if (!row) return;
              event.preventDefault();
              Queue.offerUnsafe(
                queue,
                Message.NavigatedToRow({ index: Number(row.dataset.dropdownIndex) }),
              );
            };
            // Menu blur dismisses a flat popup. Moving between its editable header
            // and its row container stays inside this composed control.
            const blur = (event: FocusEvent) => {
              if (event.relatedTarget instanceof Node && popup.contains(event.relatedTarget))
                event.stopImmediatePropagation();
              else initialFocus = true;
            };
            input.addEventListener('focus', focused);
            input.addEventListener('keydown', key);
            popup.addEventListener('blur', blur, true);
            popup.addEventListener('focus', entered, true);
            if (input.ownerDocument.activeElement === popup) entered();
            return () => {
              disposeSpace();
              input.removeEventListener('focus', focused);
              input.removeEventListener('keydown', key);
              popup.removeEventListener('blur', blur, true);
              popup.removeEventListener('focus', entered, true);
            };
          }),
          (dispose) => Effect.sync(dispose),
        ),
    ),
});
