/** Source search-space retention, scoped to the actual field/viewport.
 * Only an input event samples layout. Commits count rows and update the empty
 * footer; they never measure geometry or retain references to row elements. */
export function mountSearchSpace(input: HTMLInputElement): () => void {
  const viewport = input.closest<HTMLElement>('.ff-popup-viewport');
  const header = input.closest<HTMLElement>('.ff-dropdown-search');
  if (!viewport || !header) return () => {};
  const property = '--dropdown-empty-height';
  const previous = viewport.style.getPropertyValue(property);
  let shown = 0;
  let held = false;
  let disposed = false;
  const hasRows = () => viewport.querySelector('[data-dropdown-index]') !== null;
  const record = (event: Event) => {
    if (disposed || event.target !== input || held || !hasRows() || !input.isConnected) return;
    const viewportStyle = getComputedStyle(viewport);
    const headerStyle = getComputedStyle(header);
    const number = (value: string) => parseFloat(value) || 0;
    // Foldkit's Menu puts its header, groups and footer in one viewport. Hold
    // the remaining space in the footer so the viewport keeps its scroll cap.
    shown = Math.max(
      0,
      Math.min(viewport.offsetHeight, viewport.clientHeight) -
        header.offsetHeight -
        number(headerStyle.marginTop) -
        number(headerStyle.marginBottom) -
        number(viewportStyle.paddingTop) -
        number(viewportStyle.paddingBottom),
    );
  };
  const sync = () => {
    if (disposed || !input.isConnected) return;
    const empty = !hasRows();
    if (empty === held) return;
    if (!empty) {
      viewport.style.removeProperty(property);
      held = false;
    } else if (shown > 0) {
      viewport.style.setProperty(property, `${shown}px`);
      held = true;
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(viewport, { childList: true, subtree: true });
  // Capture before the field's Foldkit input handler dispatches its Message.
  viewport.addEventListener('input', record, true);
  return () => {
    disposed = true;
    observer.disconnect();
    viewport.removeEventListener('input', record, true);
    if (previous) viewport.style.setProperty(property, previous);
    else viewport.style.removeProperty(property);
  };
}
