import { animate, frame, cancelFrame, type AnimationPlaybackControls } from 'motion';
import { pickNearest, type ItemRect } from './geometry';

export interface HoverOptions {
  /** Fields draw their own hover state while sharing the same geometry picker. */
  renderHighlight?: boolean;
  axis?: 'x' | 'y' | 'xy';
  nearest?: boolean;
  itemSelector: string;
  ownsItem?: (item: HTMLElement) => boolean;
  enabled?: () => boolean;
  onPick?: (index: number | null, point: { x: number; y: number } | null) => void;
  onWork?: (milliseconds: number) => void;
  radius?: () => string;
  tabs?: boolean;
  /** A selected sidebar destination uses aria-current instead of tab semantics. */
  selectedAttribute?: 'aria-selected' | 'aria-current';
  /** Headless primitives can own keyboard navigation while this projects visuals. */
  keyboardNavigation?: boolean;
  /** An owner can project focus itself while reusing this geometry renderer. */
  focusHighlight?: boolean;
  menu?: boolean;
  fromSelector?: string;
  followLayout?: boolean;
  /** A scoped visual controller can arbitrate pointer versus native focus. */
  trackPointer?: boolean;
  isInstant?: () => boolean;
  /** Visual-only slot moves do not change registered item geometry. */
  ignoreLayoutMutation?: (record: MutationRecord) => boolean;
  /** Live animated geometry, without reading layout during motion frames. */
  onFrame?: (box: { x: number; y: number; width: number; height: number; opacity: number }) => void;
}
export interface HoverEngine {
  move(x: number, y: number, target?: EventTarget | null): void;
  leave(): void;
  measure(): void;
  /** Project a row without moving focus or handling keyboard navigation. */
  highlight(index: number | null): void;
  dispose(): void;
  readonly rects: readonly ItemRect[];
  readonly active: number | null;
  readonly items: readonly HTMLElement[];
}
/** A mounted DOM projection: geometry is cached on resize, pointer moves are
 * coalesced to one pick per frame, and same-size travel writes only transform. */
export function mountHover(container: HTMLElement, options: HoverOptions): HoverEngine {
  let items: HTMLElement[] = [],
    rects: ItemRect[] = [],
    active: number | null = null;
  let moveFrame = 0,
    measureFrame = 0,
    sessionPending = true,
    disposed = false;
  let pointerInside = false;
  let layer: HTMLDivElement | undefined, travel: AnimationPlaybackControls | undefined;
  let opacity: AnimationPlaybackControls | undefined,
    exitTimer: ReturnType<typeof setTimeout> | undefined;
  let selectedLayer: HTMLDivElement | undefined,
    selectedTravel: AnimationPlaybackControls | undefined;
  let latest: { x: number; y: number; target?: EventTarget | null } | undefined;
  const hiddenItems = new WeakSet<HTMLElement>();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const live = { x: 0, y: 0, width: 0, height: 0, opacity: 0 };
  const emit = () => {
    if (!disposed) options.onFrame?.({ ...live });
  };
  const notify = () => {
    if (options.onFrame && !disposed) frame.postRender(emit);
  };
  const moveLayer = (rect: ItemRect, duration: number) => {
    const node = layer!;
    const from = { ...live };
    const paint = (progress: number) => {
      if (node !== layer || disposed) return;
      live.x = from.x + (rect.left - from.x) * progress;
      live.y = from.y + (rect.top - from.y) * progress;
      live.width = from.width + (rect.width - from.width) * progress;
      live.height = from.height + (rect.height - from.height) * progress;
      Object.assign(node.style, {
        transform: `translateX(${live.x}px) translateY(${live.y}px)`,
        width: `${live.width}px`,
        height: `${live.height}px`,
      });
      notify();
    };
    // One numeric Motion clock owns the paint and its reported geometry,
    // as for opacity below. Instant snaps never enter Motion's cached DOM
    // transform path, so a later pointer move cannot restore stale axes.
    if (duration === 0) {
      paint(1);
      return undefined;
    }
    return animate(0, 1, { type: 'spring', duration, bounce: 0, onUpdate: paint });
  };
  const fadeLayer = (target: number, duration: number) => {
    const node = layer!;
    if (!options.onFrame) return animate(node, { opacity: target }, { duration });
    // DOM opacity can run on WAAPI without per-value callbacks. A numeric
    // Motion animation keeps its paint and reported opacity on the same clock.
    return animate(live.opacity, target, {
      duration,
      onUpdate: (value) => {
        if (node !== layer || disposed) return;
        node.style.opacity = String(value);
        live.opacity = value;
        notify();
      },
    });
  };
  const disabled = (item: HTMLElement) =>
    item.matches(':disabled,[aria-disabled=true],[data-disabled]') ||
    !!item.closest('[data-sidebar=menu-sub][data-state=closed]') ||
    hiddenItems.has(item);
  const selectionAttribute = options.selectedAttribute ?? 'aria-selected';
  const selectedIndex = () =>
    items.findIndex((item) =>
      selectionAttribute === 'aria-current'
        ? ['page', 'location'].includes(item.getAttribute(selectionAttribute) ?? '')
        : item.getAttribute(selectionAttribute) === 'true',
    );
  const clearMark = () => {
    if (active !== null) items[active]?.removeAttribute('data-fluid-hover-active');
    container.removeAttribute('data-fluid-hover-active-index');
  };
  const removeLayer = () => {
    travel?.stop();
    opacity?.stop();
    layer?.remove();
    layer = undefined;
    live.opacity = 0;
    notify();
  };
  const show = (index: number | null, point: { x: number; y: number } | null) => {
    options.onPick?.(index, point);
    let crossesSelected = false;
    if (options.tabs) {
      const selected = selectedIndex();
      container.classList.toggle('ff-tabs-hovering', index !== null && index !== selected);
      if (index === selected) index = null;
      crossesSelected =
        active !== null &&
        index !== null &&
        Math.min(active, index) < selected &&
        selected < Math.max(active, index);
    }
    if (layer) layer.style.borderRadius = options.radius?.() ?? '8px';
    if (index === active && !sessionPending) return;
    clearMark();
    active = index;
    if (index === null) {
      sessionPending = true;
      if (layer) {
        if (exitTimer) clearTimeout(exitTimer);
        opacity?.stop();
        travel?.stop();
        opacity = fadeLayer(0, 0.06);
        exitTimer = setTimeout(removeLayer, 60);
      }
      return;
    }
    const rect = rects[index],
      item = items[index];
    if (!rect || !item) return;
    item.setAttribute('data-fluid-hover-active', '');
    container.dataset.fluidHoverActiveIndex = String(index);
    if (options.renderHighlight === false) {
      sessionPending = false;
      return;
    }
    if (exitTimer) clearTimeout(exitTimer);
    const fresh = sessionPending || !layer || crossesSelected;
    sessionPending = false;
    if (fresh) {
      removeLayer();
      layer = document.createElement('div');
      layer.dataset.slot = 'fluid-hover-highlight';
      layer.className = 'ff-hover-highlight';
      const origin =
        options.fromSelector && !options.tabs
          ? (rects[items.findIndex((item) => item.matches(options.fromSelector!))] ?? rect)
          : rect;
      Object.assign(layer.style, {
        left: '0px',
        top: '0px',
        width: origin.width + 'px',
        height: origin.height + 'px',
        transform: `translateX(${origin.left}px) translateY(${origin.top}px)`,
        opacity: '0',
        borderRadius: options.radius?.() ?? '8px',
      });
      Object.assign(live, {
        x: origin.left,
        y: origin.top,
        width: origin.width,
        height: origin.height,
        opacity: 0,
      });
      notify();
      container.prepend(layer);
      opacity = fadeLayer(options.tabs ? 0.4 : 1, 0.08);
      if (options.fromSelector && !options.tabs)
        travel = moveLayer(rect, reduced.matches ? 0 : 0.08);
      return;
    }
    if (!layer) return;
    opacity?.stop();
    opacity = fadeLayer(options.tabs ? 0.4 : 1, 0.08);
    travel?.stop();
    // Motion uses the same critically damped fast token as the reference.
    travel = moveLayer(rect, reduced.matches || options.isInstant?.() ? 0 : 0.08);
  };
  const measure = () => {
    const previous = active !== null ? items[active] : undefined;
    const nextItems = [...container.querySelectorAll<HTMLElement>(options.itemSelector)].filter(
      (item) => options.ownsItem?.(item) ?? true,
    );
    // Clear against the old registration before replacing its index. Otherwise
    // a removed row keeps its marker and we clear whichever row took its place.
    if (previous && !nextItems.includes(previous)) show(null, null);
    else if (previous) {
      active = nextItems.indexOf(previous);
      container.dataset.fluidHoverActiveIndex = String(active);
    }
    items = nextItems;
    rects = items.map((item) => {
      let top = item.offsetTop,
        left = item.offsetLeft,
        ancestor = item.offsetParent;
      while (
        ancestor instanceof HTMLElement &&
        ancestor !== container &&
        container.contains(ancestor)
      ) {
        top += ancestor.offsetTop + ancestor.clientTop;
        left += ancestor.offsetLeft + ancestor.clientLeft;
        ancestor = ancestor.offsetParent;
      }
      const height = item.offsetHeight;
      if (height === 0) hiddenItems.add(item);
      else hiddenItems.delete(item);
      return { top, left, width: item.offsetWidth, height };
    });
    if (options.followLayout) {
      if (latest) pick();
      const rect = active === null ? undefined : rects[active];
      if (layer && rect) {
        travel?.stop();
        travel = undefined;
        Object.assign(layer.style, {
          transform: `translateX(${rect.left}px) translateY(${rect.top}px)`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        });
        Object.assign(live, { x: rect.left, y: rect.top, width: rect.width, height: rect.height });
        notify();
      }
    }
  };
  const syncSelected = () => {
    if (!options.tabs && !options.selectedAttribute) return;
    const rect = rects[selectedIndex()];
    if (!rect) {
      selectedTravel?.stop();
      selectedLayer?.remove();
      selectedLayer = undefined;
      return;
    }
    const fresh = !selectedLayer;
    if (!selectedLayer) {
      selectedLayer = document.createElement('div');
      selectedLayer.dataset.slot = 'fluid-hover-highlight';
      selectedLayer.className = 'ff-selected-highlight';
      selectedLayer.style.left = '0px';
      selectedLayer.style.top = '0px';
      container.prepend(selectedLayer);
    }
    selectedLayer.style.borderRadius = options.radius?.() ?? '8px';
    selectedTravel?.stop();
    selectedTravel = animate(
      selectedLayer,
      { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      { type: 'spring', duration: fresh || reduced.matches ? 0 : 0.16, bounce: 0 },
    );
  };
  const refreshGeometry = () => {
    cancelAnimationFrame(measureFrame);
    measureFrame = 0;
    if (disposed) return;
    measure();
    syncSelected();
  };
  const scheduleMeasure = () => {
    cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(refreshGeometry);
  };
  const pick = () => {
    moveFrame = 0;
    if (disposed || !latest) return;
    const point = latest;
    if (options.enabled && !options.enabled()) {
      show(null, null);
      return;
    }
    let next: number | null = null;
    if (options.nearest)
      next = pickNearest({
        axis: options.axis ?? 'y',
        point,
        rects,
        containerRect: container.getBoundingClientRect(),
        scroll: { x: container.scrollLeft, y: container.scrollTop },
        border: { x: container.clientLeft, y: container.clientTop },
        layoutSize: { width: container.offsetWidth, height: container.offsetHeight },
        isDisabled: (i) => {
          const item = items[i];
          return !item || disabled(item);
        },
      });
    else if (point.target instanceof Node) {
      let hit: HTMLElement | undefined;
      items.forEach((item, i) => {
        if (
          !disabled(item) &&
          item.contains(point.target instanceof Node ? point.target : null) &&
          (!hit || hit.contains(item))
        ) {
          hit = item;
          next = i;
        }
      });
    }
    show(next, point);
  };
  const move = (x: number, y: number, target?: EventTarget | null) => {
    if (options.enabled && !options.enabled()) {
      if (active !== null) leave();
      return;
    }
    latest = { x, y, target };
    if (options.onWork) {
      const start = performance.now();
      pickNearest({
        axis: options.axis ?? 'y',
        point: latest,
        rects,
        containerRect: container.getBoundingClientRect(),
        scroll: { x: container.scrollLeft, y: container.scrollTop },
        border: { x: container.clientLeft, y: container.clientTop },
        layoutSize: { width: container.offsetWidth, height: container.offsetHeight },
      });
      options.onWork(performance.now() - start);
    }
    if (!moveFrame) moveFrame = requestAnimationFrame(pick);
  };
  const leave = () => {
    pointerInside = false;
    cancelAnimationFrame(moveFrame);
    moveFrame = 0;
    latest = undefined;
    show(null, null);
  };
  const onMove = (e: PointerEvent) => {
    pointerInside = true;
    if (e.pointerType !== 'touch') move(e.clientX, e.clientY, e.target);
  };
  const onEnter = () => {
    pointerInside = true;
    sessionPending = true;
  };
  const onFocus = (e: FocusEvent) => {
    if (options.focusHighlight === false) return;
    const i = items.findIndex((item) => item.contains(e.target instanceof Node ? e.target : null));
    const item = items[i];
    if (item && !disabled(item)) show(i, null);
  };
  const onBlur = (e: FocusEvent) => {
    if (options.focusHighlight === false) return;
    if (options.tabs && pointerInside) return;
    if (!(e.relatedTarget instanceof Node) || !container.contains(e.relatedTarget)) leave();
  };
  const onKey = (e: KeyboardEvent) => {
    if (options.keyboardNavigation === false) return;
    if (!(options.tabs || options.menu) || !(e.target instanceof Node)) return;
    const available = items.filter((item) => !disabled(item));
    const current = available.findIndex((item) => item.contains(e.target as Node));
    if (current < 0) return;
    let next: number;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = available.length - 1;
    else if (e.key === 'ArrowRight' || (options.menu && e.key === 'ArrowDown'))
      next = (current + 1) % available.length;
    else if (e.key === 'ArrowLeft' || (options.menu && e.key === 'ArrowUp'))
      next = (current + available.length - 1) % available.length;
    else return;
    e.preventDefault();
    if (options.tabs)
      available.forEach((item, i) => {
        item.tabIndex = i === next ? 0 : -1;
      });
    available[next]?.focus();
  };
  const onClick = (e: MouseEvent) => {
    if (!options.nearest || active === null || (!options.enabled?.() && options.enabled)) return;
    if (!(e.target instanceof Element) || !container.contains(e.target)) return;
    if (items.some((item) => item.contains(e.target instanceof Node ? e.target : null))) return;
    if (e.target.closest('input,textarea,select,button,a,summary,[contenteditable],[role=button]'))
      return;
    const item = items[active];
    if (!item || disabled(item)) return;
    const control = item.matches('button,a,[role]')
      ? item
      : item.querySelector<HTMLElement>('button,a,[role]');
    control?.click();
  };
  // ResizeObserver runs after layout. Read its fresh geometry here: deferring
  // to the next frame can put these reads after a new application patch and
  // force layout again during continuous changes such as accent picking.
  const ro = new ResizeObserver(refreshGeometry);
  const shapeObserver = new MutationObserver(() => {
    if (layer) layer.style.borderRadius = options.radius?.() ?? '8px';
    syncSelected();
  });
  shapeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-radius'],
  });
  const mo = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'data-radius')) {
      if (layer) layer.style.borderRadius = options.radius?.() ?? '8px';
      syncSelected();
    }
    if (
      (options.tabs || options.selectedAttribute) &&
      records.some((r) => r.attributeName === selectionAttribute)
    ) {
      syncSelected();
      if (latest) pick();
      else if (options.tabs && options.focusHighlight !== false) {
        const focused = items.findIndex((item) => item.contains(document.activeElement));
        show(focused < 0 ? null : focused, null);
      }
    }
    if (
      records.some(
        (r) =>
          !options.ignoreLayoutMutation?.(r) &&
          ((r.type === 'attributes' &&
            (['data-state', 'data-size'].includes(r.attributeName ?? '') ||
              (options.tabs &&
                r.attributeName === 'class' &&
                r.target instanceof HTMLElement &&
                items.includes(r.target)))) ||
            (r.type === 'childList' &&
              [...r.addedNodes, ...r.removedNodes].some(
                (n) => n instanceof Element && !n.matches('[data-slot=fluid-hover-highlight]'),
              ))),
      )
    )
      scheduleMeasure();
  });
  measure();
  syncSelected();
  ro.observe(container);
  for (const item of items) ro.observe(item);
  mo.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-state',
      selectionAttribute,
      'data-radius',
      'data-size',
      ...(options.tabs ? ['class'] : []),
    ],
  });
  container.classList.add('ff-hover-scope');
  if (options.trackPointer !== false) {
    container.addEventListener('pointerenter', onEnter);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('pointerleave', leave);
  }
  container.addEventListener('focusin', onFocus);
  container.addEventListener('focusout', onBlur);
  container.addEventListener('keydown', onKey);
  container.addEventListener('click', onClick);
  return {
    move,
    leave,
    measure,
    highlight(index) {
      if (disposed) return;
      cancelAnimationFrame(moveFrame);
      moveFrame = 0;
      latest = undefined;
      show(index !== null && index >= 0 && index < items.length ? index : null, null);
    },
    get rects() {
      return rects;
    },
    get items() {
      return items;
    },
    get active() {
      return active;
    },
    dispose() {
      disposed = true;
      if (options.onFrame) cancelFrame(emit);
      shapeObserver.disconnect();
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(moveFrame);
      cancelAnimationFrame(measureFrame);
      if (exitTimer) clearTimeout(exitTimer);
      clearMark();
      removeLayer();
      selectedTravel?.stop();
      selectedLayer?.remove();
      container.classList.remove('ff-hover-scope');
      container.removeEventListener('pointerenter', onEnter);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerleave', leave);
      container.removeEventListener('focusin', onFocus);
      container.removeEventListener('focusout', onBlur);
      container.removeEventListener('keydown', onKey);
      container.classList.remove('ff-tabs-hovering');
      container.removeEventListener('click', onClick);
    },
  };
}
