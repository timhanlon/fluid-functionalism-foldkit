import { Message } from './state';

const instances: HTMLElement[] = [];
type KeyboardMessage =
  | typeof Message.Chose.Type
  | typeof Message.Submitted.Type
  | typeof Message.WentBack.Type
  | typeof Message.Skipped.Type;

/** Native event routing mirrors the source's row, root and document handlers.
 * Only numbered picks are global; navigation and submission belong to the card. */
export function bindKeyboard(
  root: HTMLElement,
  callbacks: {
    send: (message: KeyboardMessage) => void;
    activeIndex: () => number | null;
    markFocusRestore: () => void;
  },
) {
  const doc = root.ownerDocument;
  const nav = doc.defaultView!.navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const isMac = /mac/i.test(nav.userAgentData?.platform || nav.platform || '');
  const options = () => [...root.querySelectorAll<HTMLElement>('[data-auq-option]')];
  const other = () => root.querySelector<HTMLTextAreaElement>('[data-auq-field=other]');
  const isMulti = () => root.dataset.auqMulti === 'true';
  const textTarget = (target: HTMLElement) =>
    target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  const emit = (message: KeyboardMessage) => {
    callbacks.markFocusRestore();
    callbacks.send(message);
  };
  const local = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    root.dataset.auqPointer = 'false';
    const field = target.tagName === 'TEXTAREA' ? (target as HTMLTextAreaElement) : null;
    // Textarea handlers precede the rows and root handlers in the source.
    if (event.key === 'Enter' && field) {
      if (field.dataset.auqField === 'other' && !event.shiftKey && !isMulti()) {
        event.preventDefault();
        emit(Message.Submitted());
      } else if (
        field.dataset.auqField === 'free' &&
        field.dataset.multiline === 'false' &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        event.preventDefault();
        emit(Message.Submitted());
      }
    }
    const group = root.querySelector('.auq-options');
    if (group?.contains(target)) {
      const row = target.closest<HTMLElement>('[data-auq-option]');
      if (row && (event.key === ' ' || event.key === 'Enter') && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        emit(Message.Chose({ value: row.dataset.auqOption! }));
      }
      const isText = textTarget(target);
      const textOwnsKey = isText && event.key !== 'ArrowUp' && event.key !== 'ArrowDown';
      const caretCanMove =
        field &&
        ((event.key === 'ArrowUp' && field.selectionStart > 0) ||
          (event.key === 'ArrowDown' && field.selectionEnd < field.value.length));
      if (!textOwnsKey && !caretCanMove) {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          event.stopPropagation();
          const action = event.key === 'ArrowLeft' ? 'back' : 'skip';
          if (root.querySelector(`[data-auq-action=${action}]`))
            emit(action === 'back' ? Message.WentBack() : Message.Skipped());
        } else if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
          const rows = options();
          const field = other();
          const count = rows.length + (field ? 1 : 0);
          if (count) {
            event.preventDefault();
            event.stopPropagation();
            const base = isText ? rows.length : (callbacks.activeIndex() ?? -1);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? count - 1
                  : (base + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
            (next === rows.length ? field : rows[next])?.focus();
          }
        }
      }
    }
    if (event.key !== 'Enter' || !(isMac ? event.metaKey : event.ctrlKey)) return;
    const submit = root.querySelector<HTMLButtonElement>('[data-auq-action=submit]');
    if (!submit) return;
    event.preventDefault();
    if (!submit.disabled) emit(Message.Submitted());
  };
  const numbered = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (!target || textTarget(target)) return;
    if (!root.contains(target)) {
      if (instances.some((instance) => instance !== root && instance.contains(target))) return;
      const wrapped = instances.filter((instance) => target.contains(instance));
      const pool = wrapped.length ? wrapped : instances;
      if (pool.at(-1) !== root) return;
    }
    if (!/^[1-9]$/.test(event.key)) return;
    const index = Number(event.key) - 1;
    const rows = options();
    if (index < rows.length) {
      event.preventDefault();
      emit(Message.Chose({ value: rows[index]!.dataset.auqOption! }));
    } else if (index === rows.length && other()) {
      event.preventDefault();
      other()!.focus();
    }
  };
  for (const hint of root.querySelectorAll('[data-auq-modifier]'))
    hint.textContent = isMac ? '⌘' : '⌃';
  // Hints are rendered again as the question changes.
  const hints = new doc.defaultView!.MutationObserver(() => {
    for (const hint of root.querySelectorAll('[data-auq-modifier]')) {
      const text = isMac ? '⌘' : '⌃';
      if (hint.textContent !== text) hint.textContent = text;
    }
  });
  hints.observe(root, { childList: true, subtree: true });
  instances.push(root);
  root.addEventListener('keydown', local);
  doc.addEventListener('keydown', numbered);
  return () => {
    instances.splice(instances.indexOf(root), 1);
    hints.disconnect();
    root.removeEventListener('keydown', local);
    doc.removeEventListener('keydown', numbered);
  };
}
