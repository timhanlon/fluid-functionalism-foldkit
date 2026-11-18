import { defineSilentMount } from '../silent-mount';
// Adapted from Fluid Functionalism f801409, registry/default/data-table.tsx.
import { Effect } from 'effect';
import type { HighlightFrame } from '../table';
import './frozen.css';

const projections = new WeakMap<
  HTMLElement,
  { frame: (box: HighlightFrame) => void; layout: () => void }
>();
export const frozenMirrorIds = (id: string) => [`${id}-pin-left`, `${id}-pin-right`];
/** The native surface argument keeps this callback scoped, including in a
 * ShadowRoot. No native nodes or animation values enter Model. */
export function highlightFrame(box: HighlightFrame, viewport: HTMLElement) {
  projections.get(viewport)?.frame(box);
}
/** Keep the frozen paint on the same pre-animation layout as Table's fills. */
export function refreshLayout(viewport: HTMLElement) {
  projections.get(viewport)?.layout();
}
export const Mounted = defineSilentMount('DataTable.Frozen', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => (element instanceof HTMLElement ? mountFrozen(element) : () => {})),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});

/** Source pin overlays and fade compensation sit outside the masked viewport.
 * Layout is sampled on layout changes; live hover frames only write paint. */
export function mountFrozen(host: HTMLElement): () => void {
  const frame = host.parentElement;
  const viewport = frame?.querySelector<HTMLElement>(':scope > .ff-table');
  const table = viewport?.querySelector<HTMLElement>(':scope > table');
  if (!frame || !viewport || !table) return () => {};
  const doc = host.ownerDocument;
  const make = (parent: HTMLElement, className: string, side?: string) => {
    const node = doc.createElement('div');
    node.className = className;
    if (side) node.dataset.side = side;
    parent.append(node);
    return node;
  };
  const back = make(host, 'ff-data-table-fade-plane');
  const backRide = make(back, 'ff-data-table-ride');
  const bands = make(backRide, 'ff-data-table-selection-fades');
  const fadeHover = make(backRide, 'ff-data-table-hover-band');
  for (const side of ['left', 'right']) make(fadeHover, 'ff-data-table-fade-band', side);
  const front = make(host, 'ff-data-table-pin-plane');
  make(front, 'ff-data-table-bottom-fade');
  const mirrors = ['left', 'right'].map((side) => {
    const clip = make(front, 'ff-data-table-pin-clip', side);
    const rider = make(clip, 'ff-data-table-ride');
    return make(rider, 'ff-data-table-pin-mirror', side);
  });
  const hoverRide = make(front, 'ff-data-table-ride');
  const pinHover = make(hoverRide, 'ff-data-table-hover-band');
  for (const side of ['left', 'right']) make(pinHover, 'ff-data-table-pin-hover', side);
  const riders = [backRide, hoverRide, ...mirrors.map((node) => node.parentElement!)];
  const properties = new Map<string, string>();
  const set = (key: string, value: string) => {
    if (!properties.has(key)) properties.set(key, frame.style.getPropertyValue(key));
    if (frame.style.getPropertyValue(key) !== value) frame.style.setProperty(key, value);
  };
  const flag = (name: string, on: boolean) => {
    const value = String(on);
    if (frame.getAttribute(name) !== value) frame.setAttribute(name, value);
  };
  const readScroll = (box = viewport.getBoundingClientRect()) => {
    const {
      scrollLeft,
      scrollTop,
      scrollWidth,
      scrollHeight,
      clientWidth,
      clientHeight,
      clientTop,
    } = viewport;
    const head = table.querySelector('thead th')?.getBoundingClientRect();
    return {
      scrollTop,
      scrolledRight: scrollLeft > 0.5,
      moreRight: scrollWidth - clientWidth - scrollLeft > 0.5,
      moreBelow: scrollHeight - clientHeight - scrollTop > 0.5,
      headHeight: head ? Math.max(0, Math.min(clientHeight, head.bottom - box.top - clientTop)) : 0,
    };
  };
  const paintScroll = ({
    scrollTop,
    scrolledRight,
    moreRight,
    moreBelow,
    headHeight,
  }: ReturnType<typeof readScroll>) => {
    flag('data-x-start', scrolledRight);
    flag('data-x-end', moreRight);
    flag('data-y-start', scrollTop > 0.5);
    flag('data-more-below', moreBelow);
    // A scroll timeline takes precedence over the inline fallback where supported.
    for (const rider of riders) rider.style.transform = `translateY(${-scrollTop}px)`;
    set('--ff-head', `${headHeight}px`);
  };
  const scroll = () => paintScroll(readScroll());
  let disposed = false,
    signature = '';
  const observed = new Set<Element>();
  const resize = new ResizeObserver(() => layout());
  const layout = () => {
    if (disposed) return;
    const box = viewport.getBoundingClientRect(),
      outer = frame.getBoundingClientRect();
    const left = [...table.querySelectorAll<HTMLElement>('thead th[data-pinned="left"]')];
    const right = [...table.querySelectorAll<HTMLElement>('thead th[data-pinned="right"]')];
    const targets = new Set<Element>([
      viewport,
      table,
      ...left,
      ...right,
      ...table.querySelectorAll('thead th:first-child'),
    ]);
    for (const target of observed)
      if (!targets.has(target)) {
        resize.unobserve(target);
        observed.delete(target);
      }
    for (const target of targets)
      if (!observed.has(target)) {
        observed.add(target);
        resize.observe(target);
      }
    const width = viewport.clientWidth,
      total = table.offsetWidth;
    // Used CSS widths include flexible columns and fractional resizing,
    // without mistaking a temporary FLIP translation for frozen width.
    const cellWidth = (cell: HTMLElement) => {
      const style = doc.defaultView!.getComputedStyle(cell);
      const width = Number.parseFloat(style.width);
      if (!Number.isFinite(width)) return cell.offsetWidth;
      return style.boxSizing === 'border-box'
        ? width
        : width +
            Number.parseFloat(style.paddingLeft) +
            Number.parseFloat(style.paddingRight) +
            Number.parseFloat(style.borderLeftWidth) +
            Number.parseFloat(style.borderRightWidth);
    };
    const pinLeft = left.reduce((sum, cell) => sum + cellWidth(cell), 0);
    const pinRight = right.reduce((sum, cell) => sum + cellWidth(cell), 0);
    const selected = new Set((viewport.dataset.selectedIndices ?? '').split(',').filter(Boolean));
    const runs: { top: number; bottom: number }[] = [];
    for (const row of table.querySelectorAll<HTMLElement>('tbody tr[data-fluid-hover-index]')) {
      if (!selected.has(row.dataset.fluidHoverIndex!)) continue;
      let top = row.offsetTop,
        parent = row.offsetParent;
      while (parent instanceof HTMLElement && parent !== viewport && viewport.contains(parent)) {
        top += parent.offsetTop + parent.clientTop;
        parent = parent.offsetParent;
      }
      const bottom = top + row.offsetHeight,
        last = runs.at(-1);
      if (last && Math.abs(last.bottom - top) < 1) last.bottom = bottom;
      else runs.push({ top, bottom });
    }
    const scrollState = readScroll(box);
    const height = viewport.clientHeight;
    const scrollRange = Math.max(0, viewport.scrollHeight - height);
    const leftOffset = box.left + viewport.clientLeft - outer.left;
    const topOffset = box.top + viewport.clientTop - outer.top;
    set('--pin-l', `${pinLeft}px`);
    set('--pin-r', `${pinRight}px`);
    set('--ff-scroll-y', `${scrollRange}px`);
    set('--ff-view-width', `${width}px`);
    set('--ff-view-height', `${height}px`);
    set('--ff-view-left', `${leftOffset}px`);
    set('--ff-view-top', `${topOffset}px`);
    flag('data-frozen-left', left.length > 0);
    flag('data-frozen-right', right.length > 0);
    const ids = frozenMirrorIds(viewport.dataset.frozenId ?? '');
    mirrors.forEach((mirror, index) => {
      if (mirror.id !== ids[index]) mirror.id = ids[index]!;
      mirror.style.width = `${total}px`;
      mirror.style.transform = `translateX(${index === 0 ? 0 : pinRight - total}px)`;
    });
    const next = JSON.stringify(runs);
    if (next !== signature) {
      signature = next;
      bands.replaceChildren(
        ...runs.flatMap((run) =>
          ['left', 'right'].map((side) => {
            const band = doc.createElement('div');
            band.className = 'ff-data-table-fade-band';
            band.dataset.side = side;
            band.style.top = `${run.top}px`;
            band.style.height = `${run.bottom - run.top}px`;
            return band;
          }),
        ),
      );
    }
    paintScroll(scrollState);
  };
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.type === 'attributes' ||
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node instanceof Element &&
              !node.matches('.ff-data-table-closing') &&
              (node.matches('thead,tbody,tr,th,td') || node.querySelector('tr,th,td')),
          ),
      )
    )
      layout();
  });
  observer.observe(viewport, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-selected-indices',
      'data-pinned',
      'data-frozen-id',
      'data-size',
      'data-radius',
      'data-snap-key',
    ],
  });
  const projection = {
    layout: () => {
      // The synchronous expansion refresh already covers the pending DOM patch.
      observer.takeRecords();
      layout();
    },
    frame: (box: HighlightFrame) => {
      for (const band of [fadeHover, pinHover])
        Object.assign(band.style, {
          transform: `translateY(${box.y}px)`,
          height: `${box.height}px`,
          opacity: String(box.opacity),
        });
    },
  };
  projections.set(viewport, projection);
  viewport.addEventListener('scroll', scroll, { passive: true });
  layout();
  return () => {
    disposed = true;
    projections.delete(viewport);
    observer.disconnect();
    resize.disconnect();
    viewport.removeEventListener('scroll', scroll);
    back.remove();
    front.remove();
    for (const [name, value] of properties)
      value ? frame.style.setProperty(name, value) : frame.style.removeProperty(name);
    for (const name of [
      'data-x-start',
      'data-x-end',
      'data-y-start',
      'data-more-below',
      'data-frozen-left',
      'data-frozen-right',
    ])
      frame.removeAttribute(name);
  };
}
