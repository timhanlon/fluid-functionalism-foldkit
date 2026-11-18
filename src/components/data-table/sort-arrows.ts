// Fluid f801409 DataTableColumnHeader: one arrow rotates on the moderate spring.
import { animate, type AnimationPlaybackControls } from 'motion';
import { spring } from '../motion';

type Sort = 'none' | 'asc' | 'desc';
const rotation = (sort: Sort) => `rotate(${sort === 'desc' ? 180 : 0}deg)`;
const paintedRotation = (node: HTMLElement) => {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
  // This arrow travels only between 0 and 180 degrees. Keep interrupted
  // keyframes in the same rotate() form instead of mixing matrix() strings.
  return `rotate(${Math.abs((Math.atan2(matrix.b, matrix.a) * 180) / Math.PI)}deg)`;
};

/** Pure paint. TanStack/Foldkit still own sorting, menu activation and focus. */
export function mountSortArrows(root: HTMLElement): () => void {
  const arrows = new Map<HTMLElement, { sort: Sort; animation?: AnimationPlaybackControls }>();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => {
    const current = new Set(
      [...root.querySelectorAll<HTMLElement>('.ff-data-table-sort-arrow')].filter(
        (node) => node.closest('.ff-data-table') === root,
      ),
    );
    for (const [node, entry] of arrows)
      if (!current.has(node)) {
        entry.animation?.stop();
        arrows.delete(node);
      }
    for (const node of current) {
      const sort = node.dataset.sort as Sort;
      const entry = arrows.get(node);
      if (!entry) {
        arrows.set(node, { sort });
        continue;
      }
      if (entry.sort === sort) continue;
      const from = entry.animation ? paintedRotation(node) : rotation(entry.sort);
      entry.animation?.stop();
      entry.animation = undefined;
      entry.sort = sort;
      const target = rotation(sort);
      if (reduced.matches || from === target) {
        node.style.transform = target;
        continue;
      }
      // Hold the old paint while Motion prepares its first animation frame.
      node.style.transform = from;
      const animation = animate(
        node,
        { transform: [from, target] },
        sort === 'none' ? { ...spring.fast.exit, ease: 'easeIn' } : spring.moderate,
      );
      entry.animation = animation;
      void animation.then(() => {
        if (entry.animation === animation) entry.animation = undefined;
      });
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-sort'],
  });
  sync();
  return () => {
    observer.disconnect();
    for (const [node, entry] of arrows) {
      entry.animation?.stop();
      node.style.transform = rotation(entry.sort);
    }
    arrows.clear();
  };
}
