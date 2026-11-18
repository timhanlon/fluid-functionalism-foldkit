import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';
import { retainObjectUrl } from './object-urls';
import { renderPdfFirstPage } from './pdf';
import { attachmentName, attachmentType, type Attachment } from './types';
export interface Host extends HTMLElement {
  ffThumbnailFile?: Attachment;
}
export function mountThumbnail(element: Element): () => void {
  if (!(element instanceof HTMLElement)) return () => {};
  const root: Host = element,
    output = root.querySelector<HTMLElement>('.ff-thumbnail-preview');
  if (!output) return () => {};
  let current: Attachment | undefined,
    size = 0,
    request = 0,
    pdfUrl: string | undefined;
  let failedUrl: string | undefined;
  let image: { file: File; url: string; release: () => void } | undefined;
  let pending: AbortController | undefined;
  const paint = (
    url: string | undefined,
    state: 'loading' | 'ready' | 'failed' | 'file',
    file: Attachment,
    onError?: () => void,
  ) => {
    root.dataset.previewState = state;
    if (url) {
      let img = output.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        output.replaceChildren(img);
      }
      img.onerror = onError ?? null;
      img.src = url;
      img.alt = attachmentName(file);
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
    const local = 'url' in file ? undefined : file,
      type = attachmentType(file),
      isImage = type === 'image' || type.startsWith('image/'),
      isPdf = !!local && type === 'application/pdf';
    if (image && (!isImage || image.file !== local)) {
      image.release();
      image = undefined;
    }
    if (!isPdf) pdfUrl = undefined;
    if (isImage) {
      if (local) {
        image ??= { ...retainObjectUrl(local), file: local };
        paint(image.url, 'ready', file);
      } else if ('url' in file) {
        if (file.url === failedUrl) paint(undefined, 'failed', file);
        else
          paint(file.url, 'ready', file, () => {
            if (version !== request) return;
            failedUrl = file.url;
            paint(undefined, 'failed', file);
          });
      }
    } else if (isPdf && local) {
      paint(pdfUrl, pdfUrl ? 'ready' : 'loading', file);
      const controller = new AbortController();
      pending = controller;
      renderPdfFirstPage(local, size, controller.signal).then(
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
    const img = output.querySelector('img');
    if (img) img.onerror = null;
  };
}
export const Mounted = defineSilentMount('FileThumbnail.Preview', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => mountThumbnail(element)),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
