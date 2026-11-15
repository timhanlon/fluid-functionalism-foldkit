type PdfjsModule = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfjsModule> | undefined;
let workerSrc: string | undefined;
/** Override the matching CDN worker when the embedding application hosts its
 * own worker (for example under a restrictive content security policy). */
export function setPdfWorkerSrc(src: string): void {
  workerSrc = src;
  pdfjsPromise?.then((module) => {
    module.GlobalWorkerOptions.workerSrc = src;
  });
}
export function loadPdfjs(): Promise<PdfjsModule> {
  return (pdfjsPromise ??= import('pdfjs-dist').then((module) => {
    if (workerSrc) module.GlobalWorkerOptions.workerSrc = workerSrc;
    else if (!module.GlobalWorkerOptions.workerSrc)
      module.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${module.version}/build/pdf.worker.min.mjs`;
    return module;
  }));
}
/** Render at 2× thumbnail width; release the PDF document/worker even when
 * parsing, rendering, or a superseding thumbnail request interrupts the work. */
export async function renderPdfFirstPage(
  file: File,
  targetWidth: number,
  signal?: AbortSignal,
): Promise<string> {
  const pdfjs = await loadPdfjs();
  signal?.throwIfAborted();
  const data = await file.arrayBuffer();
  signal?.throwIfAborted();
  const task = pdfjs.getDocument({ data });
  const abort = () => {
    void task.destroy();
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    signal?.throwIfAborted();
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (targetWidth * 2) / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    signal?.throwIfAborted();
    return canvas.toDataURL('image/png');
  } finally {
    signal?.removeEventListener('abort', abort);
    await task.destroy();
  }
}
