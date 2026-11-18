function canScroll(overflow: string, delta: number, at: number, size: number, view: number) {
  return (
    !!delta &&
    (overflow === 'auto' || overflow === 'scroll') &&
    (delta < 0 ? at > 0 : Math.ceil(at + view) < size)
  );
}
function scrollerFor(element: Element, dx: number, dy: number): Element | null {
  for (
    let node: Element | null = element;
    node && node !== document.scrollingElement && node !== document.body;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    if (
      canScroll(style.overflowY, dy, node.scrollTop, node.scrollHeight, node.clientHeight) ||
      canScroll(style.overflowX, dx, node.scrollLeft, node.scrollWidth, node.clientWidth)
    )
      return node;
  }
  return null;
}

/** Presentation/input routing for a primitive-owned backdrop. This neither
 * portals nor dismisses a popup: the official primitive keeps those owners. */
export function mountPopupShield(shield: HTMLElement, anchorId: string): () => void {
  const previousClip = shield.style.getPropertyValue('clip-path');
  const cut = () => {
    const anchor = document.getElementById(anchorId);
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    // Foldkit may portal its backdrop beside the trigger within a transformed
    // dialog panel. CSS clip coordinates belong to that box, not the viewport.
    const box = shield.getBoundingClientRect();
    // offsetWidth/Height round fractional CSS layout. Prefer computed layout
    // sizes so an unscaled fractional panel is not mistaken for a transform.
    const style = getComputedStyle(shield);
    const width = parseFloat(style.width) || shield.offsetWidth;
    const height = parseFloat(style.height) || shield.offsetHeight;
    const sx = box.width && width ? box.width / width : 1;
    const sy = box.height && height ? box.height / height : 1;
    const left = (r.left - box.left) / sx,
      right = (r.right - box.left) / sx;
    const top = (r.top - box.top) / sy,
      bottom = (r.bottom - box.top) / sy;
    shield.style.setProperty(
      'clip-path',
      'polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ' +
        `${left}px ${top}px, ${left}px ${bottom}px, ${right}px ${bottom}px, ${right}px ${top}px, ${left}px ${top}px)`,
    );
  };
  let observer: ResizeObserver | undefined;
  const anchor = anchorId ? document.getElementById(anchorId) : null;
  if (anchor) {
    cut();
    observer = new ResizeObserver(cut);
    observer.observe(anchor);
    observer.observe(document.body);
    observer.observe(shield);
    window.addEventListener('scroll', cut, true);
    window.addEventListener('resize', cut);
  }
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey) return;
    const under = document
      .elementsFromPoint(event.clientX, event.clientY)
      .find((element) => element.getAttribute('data-slot') !== 'popup-shield');
    const scroller = under && scrollerFor(under, event.deltaX, event.deltaY);
    if (!scroller) return; // The browser scrolls the document normally.
    event.preventDefault();
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? scroller.clientHeight
          : 1;
    scroller.scrollBy(event.deltaX * unit, event.deltaY * unit);
  };
  const context = (event: Event) => event.preventDefault();
  shield.addEventListener('wheel', wheel, { passive: false });
  shield.addEventListener('contextmenu', context);
  return () => {
    observer?.disconnect();
    window.removeEventListener('scroll', cut, true);
    window.removeEventListener('resize', cut);
    shield.removeEventListener('wheel', wheel);
    shield.removeEventListener('contextmenu', context);
    if (previousClip) shield.style.setProperty('clip-path', previousClip);
    else shield.style.removeProperty('clip-path');
  };
}

/** Bind only the backdrop projected for this popup. Its own Mount still owns
 * the official portal; this helper shares the popup visual scope's lifetime. */
export function mountPopupShieldFor(popup: HTMLElement): () => void {
  const shield = [...document.querySelectorAll<HTMLElement>('[data-shield-for]')].find(
    (element) => element.dataset.shieldFor === popup.id,
  );
  return shield ? mountPopupShield(shield, shield.dataset.shieldAnchor ?? '') : () => {};
}
