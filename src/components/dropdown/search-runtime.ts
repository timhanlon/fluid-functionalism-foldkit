import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { Message } from './search-state';

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
            const focused = () => Queue.offerUnsafe(queue, Message.SearchFocused({}));
            const key = (event: KeyboardEvent) => {
              if (event.defaultPrevented) return;
              if (event.key === 'Escape' || event.key === 'Tab') return;
              // Editing the search field must not invoke Menu's printable-key handler.
              event.stopPropagation();
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
            };
            input.addEventListener('focus', focused);
            input.addEventListener('keydown', key);
            popup.addEventListener('blur', blur, true);
            return () => {
              input.removeEventListener('focus', focused);
              input.removeEventListener('keydown', key);
              popup.removeEventListener('blur', blur, true);
            };
          }),
          (dispose) => Effect.sync(dispose),
        ),
    ),
});
