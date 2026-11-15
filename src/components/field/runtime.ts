import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
/** Link only this field's messages. Preserve caller-provided ids and skip
 * nested fields, whose controls are described by their own mounted owner. */
export function linkDescriptions(root: HTMLElement): () => void {
  const managed = new Map<HTMLElement, readonly string[]>();
  const remove = (control: HTMLElement, ids: readonly string[]) => {
    const retained = (control.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id && !ids.includes(id));
    const next = retained.join(' ');
    if (next !== (control.getAttribute('aria-describedby') ?? '')) {
      if (next) control.setAttribute('aria-describedby', next);
      else control.removeAttribute('aria-describedby');
    }
  };
  const sync = () => {
    const own = (element: Element) => element.closest('[data-slot=field]') === root;
    const controls = [
      ...root.querySelectorAll<HTMLElement>(
        '[data-slot=input],[data-slot=textarea],[data-slot=checkbox],[role=combobox],[role=switch],[role=checkbox]',
      ),
    ];
    const control =
      controls.find(own) ??
      [
        ...root.querySelectorAll<HTMLElement>(
          'input:not([type=hidden]):not([aria-hidden=true]),textarea,select',
        ),
      ].find(own);
    for (const [previous, ids] of managed)
      if (previous !== control) {
        remove(previous, ids);
        managed.delete(previous);
      }
    if (!control) return;
    const ids = [
      ...root.querySelectorAll<HTMLElement>(
        '[data-slot=field-description],[data-slot=field-error]',
      ),
    ]
      .filter(own)
      .map((node) => node.id)
      .filter(Boolean);
    const previous = managed.get(control) ?? [];
    const theirs = (control.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id && !previous.includes(id));
    const next = [...new Set([...theirs, ...ids])].join(' ');
    managed.set(control, ids);
    if (next !== (control.getAttribute('aria-describedby') ?? '')) {
      if (next) control.setAttribute('aria-describedby', next);
      else control.removeAttribute('aria-describedby');
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['id', 'data-slot', 'aria-describedby'],
  });
  sync();
  return () => {
    observer.disconnect();
    for (const [control, ids] of managed) remove(control, ids);
  };
}
export const Mounted = Mount.define('Field.Descriptions', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => (element instanceof HTMLElement ? linkDescriptions(element) : () => {})),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
