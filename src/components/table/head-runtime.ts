import { animate, type AnimationPlaybackControls } from 'motion';
import { shapeRadius } from '../shape';
import { spring } from '../motion';

/** Header fill only: controls, popups and column drag retain their owners. */
export function mountHeadHighlight(root: HTMLElement): () => void {
  const owner = root.ownerDocument.defaultView!;
  const owns = (node: Element) => node.closest('.ff-table') === root;
  let heads: HTMLElement[] = [];
  let rects = new Map<string, { x: number; y: number; width: number; height: number }>();
  let hovered: string | null = null,
    pressed: string | null = null;
  let layer: HTMLDivElement | undefined,
    geometry = '';
  let travel: AnimationPlaybackControls | undefined, opacity: AnimationPlaybackControls | undefined;
  let removal: ReturnType<typeof setTimeout> | undefined;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const remove = () => {
    travel?.stop();
    opacity?.stop();
    layer?.remove();
    layer = undefined;
    geometry = '';
  };
  const paint = () => {
    const held = root.dataset.heldHeadIndex || null;
    const shown = root.dataset.hideHeadHighlight !== 'true' ? (held ?? hovered) : null;
    const rect = shown === null ? undefined : rects.get(shown);
    if (!rect) {
      if (layer && !removal) {
        opacity?.stop();
        opacity = animate(layer, { opacity: 0 }, spring.fast.exit);
        removal = setTimeout(() => {
          removal = undefined;
          remove();
        }, 160);
      }
      return;
    }
    if (removal) {
      clearTimeout(removal);
      removal = undefined;
    }
    const radius = `${shapeRadius(root.dataset.radius, 8, 9999)}px`;
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'ff-table-head-highlight';
      layer.setAttribute('aria-hidden', 'true');
      Object.assign(layer.style, {
        left: '0px',
        top: '0px',
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: `translateX(${rect.x}px) translateY(${rect.y}px)`,
        opacity: '0',
      });
      root.prepend(layer);
    }
    layer.style.borderRadius = radius;
    layer.toggleAttribute(
      'data-pressed',
      held !== null || (pressed !== null && pressed === hovered),
    );
    const next = JSON.stringify(rect);
    if (next !== geometry) {
      travel?.stop();
      travel = animate(layer, rect, {
        type: spring.fast.type,
        duration: reduced.matches ? 0 : spring.fast.duration,
        bounce: spring.fast.bounce,
      });
      geometry = next;
    }
    opacity?.stop();
    opacity = animate(layer, { opacity: 1 }, { duration: 0.08 });
  };
  const measure = () => {
    const rootBox = root.getBoundingClientRect();
    const scaleX = root.offsetWidth ? rootBox.width / root.offsetWidth : 1;
    const scaleY = root.offsetHeight ? rootBox.height / root.offsetHeight : 1;
    rects = new Map(
      heads.map((head) => {
        let x = head.offsetLeft,
          y = head.offsetTop,
          parent = head.offsetParent;
        while (parent instanceof HTMLElement && parent !== root && root.contains(parent)) {
          x += parent.offsetLeft + parent.clientLeft;
          y += parent.offsetTop + parent.clientTop;
          parent = parent.offsetParent;
        }
        // Sticky cells move relative to their layout offsets while scrolling.
        // The fill lives in the viewport's scrollable coordinate space.
        if (owner.getComputedStyle(head).position === 'sticky') {
          const box = head.getBoundingClientRect();
          x = (box.left - rootBox.left) / (scaleX || 1) + root.scrollLeft - root.clientLeft;
          y = (box.top - rootBox.top) / (scaleY || 1) + root.scrollTop - root.clientTop;
        }
        return [
          head.dataset.headHover!,
          { x, y, width: head.offsetWidth, height: Math.max(0, head.offsetHeight - 1) },
        ];
      }),
    );
    paint();
  };
  const resize = new ResizeObserver(measure);
  const register = () => {
    heads.forEach((head) => resize.unobserve(head));
    heads = [...root.querySelectorAll<HTMLElement>('.ff-table-head[data-head-hover]')].filter(owns);
    heads.forEach((head) => resize.observe(head));
    measure();
  };
  const headAt = (target: EventTarget | null) => {
    const head =
      target instanceof Element
        ? target.closest<HTMLElement>('.ff-table-head[data-head-hover]')
        : null;
    return head && owns(head) ? head.dataset.headHover! : null;
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return;
    const next = headAt(event.target);
    if (next !== hovered) {
      hovered = next;
      paint();
    }
  };
  const leave = () => {
    hovered = null;
    paint();
  };
  const down = (event: PointerEvent) => {
    if (event.button === 0 && headAt(event.target) !== null) {
      pressed = hovered;
      paint();
    }
  };
  const release = () => {
    if (pressed !== null) {
      pressed = null;
      paint();
    }
  };
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.attributeName === 'data-head-hover' ||
          (record.type === 'childList' &&
            [...record.addedNodes, ...record.removedNodes].some(
              (node) => node instanceof Element && (node.matches('th') || node.querySelector('th')),
            )),
      )
    )
      register();
    else paint();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'data-head-hover',
      'data-held-head-index',
      'data-hide-head-highlight',
      'data-radius',
      'data-size',
    ],
  });
  resize.observe(root);
  register();
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerleave', leave);
  root.addEventListener('pointerdown', down);
  root.addEventListener('scroll', measure, { passive: true });
  owner.addEventListener('pointerup', release);
  owner.addEventListener('pointercancel', release);
  return () => {
    observer.disconnect();
    resize.disconnect();
    if (removal) clearTimeout(removal);
    remove();
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerleave', leave);
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('scroll', measure);
    owner.removeEventListener('pointerup', release);
    owner.removeEventListener('pointercancel', release);
  };
}
