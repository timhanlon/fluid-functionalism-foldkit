import { markerRenderProperty } from './marker';

type MarkerBox = { x: number; y: number; width: number; height: number; opacity: number };

/** Move the view-owned decorative slot; its VNode, IDs and cleanup keep their
 * original owner. The carrier follows animation values without layout reads. */
export function mountHoverMarker(root: HTMLElement) {
  const store = root.querySelector<HTMLElement>(':scope > .ff-table-markers');
  const carrier = root.querySelector<HTMLElement>(':scope > .ff-table-marker-carrier');
  if (!store || !carrier)
    return {
      select: (_row: HTMLElement | undefined) => {},
      frame: (_box: MarkerBox) => {},
      dispose: () => {},
    };
  let row: HTMLElement | undefined, current: HTMLElement | undefined;
  let placeholder: Comment | undefined;
  let box: MarkerBox = { x: 0, y: 0, width: 0, height: 0, opacity: 0 };
  const restore = () => {
    if (current?.parentElement === carrier && placeholder?.parentNode === store)
      store.replaceChild(current, placeholder);
    else placeholder?.remove();
    current = undefined;
    placeholder = undefined;
  };
  const paint = () => {
    Object.assign(carrier.style, {
      transform: `translateX(${box.x}px) translateY(${box.y}px)`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      opacity: current ? String(box.opacity) : '0',
    });
  };
  const refresh = () => {
    const index = row && root.contains(row) ? row.getAttribute('data-fluid-hover-index') : null;
    if (index === null) {
      if (box.opacity <= 0) restore();
      paint();
      return;
    }
    const next =
      current?.isConnected && current.dataset.tableHoverMarker === index
        ? current
        : [...store.children].find(
            (node): node is HTMLElement =>
              node instanceof HTMLElement && node.dataset.tableHoverMarker === index,
          );
    if (next === current && current?.parentElement === carrier) return;
    restore();
    if (next?.isConnected && next.parentElement === store) {
      placeholder = root.ownerDocument.createComment('ff-table-marker');
      store.replaceChild(placeholder, next);
      carrier.append(next);
      current = next;
    }
    paint();
  };
  const descriptor = Object.getOwnPropertyDescriptor(store, markerRenderProperty);
  let renderValue = (store as unknown as Record<string, unknown>)[markerRenderProperty];
  Object.defineProperty(store, markerRenderProperty, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: () => renderValue,
    set: (value: unknown) => {
      restore();
      renderValue = value;
    },
  });
  const observer = new MutationObserver(refresh);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-table-hover-marker', 'data-fluid-hover-index'],
  });
  return {
    select(next: HTMLElement | undefined) {
      row = next;
      refresh();
    },
    frame(next: MarkerBox) {
      box = next;
      if (box.opacity <= 0 && !row) restore();
      paint();
    },
    dispose() {
      observer.disconnect();
      restore();
      if (!descriptor) Reflect.deleteProperty(store, markerRenderProperty);
      else
        Object.defineProperty(
          store,
          markerRenderProperty,
          descriptor.get || descriptor.set ? descriptor : { ...descriptor, value: renderValue },
        );
      for (const key of ['transform', 'width', 'height', 'opacity'])
        carrier.style.removeProperty(key);
    },
  };
}
