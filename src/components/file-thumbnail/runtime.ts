import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import { retainObjectUrl } from './object-urls';
import { renderPdfFirstPage } from './pdf';
export interface Host extends HTMLElement {
  ffThumbnailFile?: File;
}
export const Mounted = Mount.define('FileThumbnail.Preview', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root: Host = element,
          output = root.querySelector<HTMLElement>('.ff-thumbnail-preview');
        if (!output) return () => {};
        let current: File | undefined,
          size = 0,
          request = 0,
          pdfUrl: string | undefined;
        let image: { file: File; url: string; release: () => void } | undefined;
        let pending: AbortController | undefined;
        const paint = (
          url: string | undefined,
          state: 'loading' | 'ready' | 'failed' | 'file',
          file: File,
        ) => {
          root.dataset.previewState = state;
          if (url) {
            let img = output.querySelector('img');
            if (!img) {
              img = document.createElement('img');
              output.replaceChildren(img);
            }
            img.src = url;
            img.alt = file.name;
          } else output.replaceChildren();
        };
        const sync = () => {
          const file = root.ffThumbnailFile,
            nextSize = Number(root.dataset.size);
          if (!file || (current === file && size === nextSize)) return;
          current = file;
          size = nextSize;
          const version = ++request;
          pending?.abort();
          pending = undefined;
          const isImage = file.type.startsWith('image/'),
            isPdf = file.type === 'application/pdf';
          if (image && (!isImage || image.file !== file)) {
            image.release();
            image = undefined;
          }
          if (!isPdf) pdfUrl = undefined;
          if (isImage) {
            image ??= { ...retainObjectUrl(file), file };
            paint(image.url, 'ready', file);
          } else if (isPdf) {
            paint(pdfUrl, pdfUrl ? 'ready' : 'loading', file);
            const controller = new AbortController();
            pending = controller;
            renderPdfFirstPage(file, size, controller.signal).then(
              (url) => {
                if (version !== request || controller.signal.aborted) return;
                pdfUrl = url;
                paint(url, 'ready', file);
              },
              () => {
                if (version !== request || controller.signal.aborted) return;
                // Like the reference, an existing PDF preview stays visible when a
                // later render fails; without one, the generic file glyph takes over.
                paint(pdfUrl, pdfUrl ? 'ready' : 'failed', file);
              },
            );
          } else paint(undefined, 'file', file);
        };
        const observer = new MutationObserver(sync);
        observer.observe(root, { attributes: true, attributeFilter: ['data-file', 'data-size'] });
        sync();
        return () => {
          ++request;
          observer.disconnect();
          pending?.abort();
          image?.release();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
