import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
export const Mounted = Mount.define('CodeBlock.Highlight', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root = element;
        let revision = 0;
        const sync = () => {
          const source = root.dataset.source ?? '',
            current = ++revision;
          const pre = document.createElement('pre'),
            code = document.createElement('code');
          code.textContent = source.trim();
          pre.append(code);
          root.replaceChildren(pre);
          import('./highlight')
            .then((module) => module.highlight(source))
            .then(
              (html) => {
                if (current === revision) root.innerHTML = html;
              },
              () => {},
            );
        };
        const observer = new MutationObserver(sync);
        observer.observe(root, { attributes: true, attributeFilter: ['data-source'] });
        sync();
        return () => {
          ++revision;
          observer.disconnect();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});

/** Reader intent starts loading on the whole preview header, matching the
 * reference's pointer/focus warm-up without loading Shiki with every preview. */
export const Wanted = Mount.define('CodeBlock.ReaderIntent', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const header = element.closest('[role="tablist"]')?.parentElement ?? element.parentElement;
        if (!header) return () => {};
        let wanted = false;
        const warm = () => {
          if (wanted) return;
          wanted = true;
          import('./highlight').then((module) => module.warm()).catch(() => {});
        };
        header.addEventListener('pointerenter', warm);
        header.addEventListener('focusin', warm);
        return () => {
          header.removeEventListener('pointerenter', warm);
          header.removeEventListener('focusin', warm);
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
