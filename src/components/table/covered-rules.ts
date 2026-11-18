/** Cache row divider edges between layout changes. Motion frames read only
 * this cache and write changed attributes, never measure the animated fill. */
export function mountCoveredRules(root: HTMLElement, rows: () => readonly HTMLElement[]) {
  let edges: { row: HTMLElement; bottom: number }[] | undefined;
  const covered = new WeakMap<HTMLElement, boolean>();
  const invalidate = () => {
    edges = undefined;
  };
  const resize = new ResizeObserver(invalidate);
  resize.observe(root);
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.type === 'attributes' ||
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches('thead,tbody,tr') || node.querySelector('thead,tbody,tr')),
          ) ||
          (record.target instanceof Element && !!record.target.closest('thead,tbody')),
      )
    )
      invalidate();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-size', 'data-snap-key'],
  });
  return {
    frame(box: { y: number; height: number; opacity: number }) {
      if (!edges)
        edges = rows().map((row) => {
          let top = row.offsetTop,
            parent = row.offsetParent;
          while (parent instanceof HTMLElement && parent !== root && root.contains(parent)) {
            top += parent.offsetTop + parent.clientTop;
            parent = parent.offsetParent;
          }
          return { row, bottom: top + row.offsetHeight };
        });
      const shown = box.opacity >= 0.5;
      for (const { row, bottom } of edges) {
        const on = shown && bottom >= box.y - 1.5 && bottom <= box.y + box.height + 1.5;
        if (covered.get(row) === on) continue;
        covered.set(row, on);
        row.toggleAttribute('data-under-highlight', on);
      }
    },
    dispose() {
      observer.disconnect();
      resize.disconnect();
      rows().forEach((row) => row.removeAttribute('data-under-highlight'));
    },
  };
}
