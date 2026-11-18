import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';
import { mountHover } from '../../fluid-hover/engine';
import { mountSelections } from '../selection-backgrounds/runtime';
import { shapeRadius } from '../shape';
import { mountHeadHighlight } from './head-runtime';
import { mountRowHighlight } from './highlight-runtime';
import { mountCoveredRules } from './covered-rules';
import { frameCallbackProperty, type FrameElement } from './frame';
import { mountHoverMarker } from './marker-runtime';
const layouts = new WeakMap<HTMLElement, () => void>();
/** Flush the table-owned paint before a consumer projects a layout animation. */
export function refreshLayout(root: HTMLElement) {
  layouts.get(root)?.();
}
export const Mounted = defineSilentMount('Table.Hover', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => (element instanceof HTMLElement ? mountTable(element) : () => {})),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
/** Only visual projection lives here. Rows remain native, non-focusable table
 * rows; interactive children retain their ordinary keyboard behavior.
 * `data-hover="off"` on the root (the view's `hover: false`) suspends it. */
export function mountTable(root: HTMLElement): () => void {
  const disposeHead = mountHeadHighlight(root);
  const priorWidth = root.style.getPropertyValue('--table-view-w');
  const viewport = new ResizeObserver(() => {
    root.style.setProperty('--table-view-w', `${root.clientWidth}px`);
  });
  viewport.observe(root);
  const owns = (row: HTMLElement) => row.closest('.ff-table') === root;
  const rows = () => [...root.querySelectorAll<HTMLElement>('.ff-table-row')].filter(owns);
  const rules = mountCoveredRules(root, rows);
  const marker = mountHoverMarker(root);
  let active: HTMLElement | undefined;
  let disposed = false;
  let selectionKey = root.dataset.selectedIndices ?? '';
  let rulesFrame = 0;
  const project = () => {
    if (active && !root.contains(active)) active = undefined;
    const nextSelection = root.dataset.selectedIndices ?? '';
    if (!disposed && nextSelection !== selectionKey) {
      selectionKey = nextSelection;
      root.setAttribute('data-snap-rules', '');
      cancelAnimationFrame(rulesFrame);
      rulesFrame = requestAnimationFrame(() => {
        rulesFrame = requestAnimationFrame(() => root.removeAttribute('data-snap-rules'));
      });
    }
    const selected = new Set(
      disposed ? [] : (root.dataset.selectedIndices ?? '').split(',').filter(Boolean),
    );
    for (const row of rows()) {
      const rowIndex = row.getAttribute('data-fluid-hover-index');
      const lit = row === active;
      if (row.classList.contains('is-active') !== lit) row.classList.toggle('is-active', lit);
      row.toggleAttribute('data-table-selected', rowIndex !== null && selected.has(rowIndex));
      const nextIndex = rowIndex === null ? '0' : String(Number(rowIndex) + 1);
      const bySelection = (rowIndex !== null && selected.has(rowIndex)) || selected.has(nextIndex);
      const hide = bySelection && !(rowIndex === null && row.hasAttribute('data-keep-rule'));
      row.toggleAttribute('data-table-hide-border', hide);
    }
  };
  let keyboard: ReturnType<typeof mountRowHighlight> | undefined;
  let snapKey = root.dataset.snapKey;
  let snapping = false,
    snapFrame = 0;
  let heldSlot: number | null = null;
  const hover = mountHover(root, {
    itemSelector: '.ff-table-row[data-fluid-hover-index]',
    ownsItem: owns,
    nearest: false,
    axis: 'y',
    focusHighlight: false,
    enabled: () => root.dataset.hover !== 'off',
    keyboardNavigation: false,
    trackPointer: false,
    followLayout: true,
    ignoreLayoutMutation: (record) => {
      const visual =
        '.ff-table-markers,.ff-table-marker-carrier,.ff-selection-background,.ff-table-head-highlight';
      if (record.target instanceof Element && record.target.closest(visual)) return true;
      const changed = [...record.addedNodes, ...record.removedNodes];
      return (
        record.type === 'childList' &&
        changed.length > 0 &&
        changed.every((node) => node instanceof Element && node.matches(visual))
      );
    },
    isInstant: () => snapping || (keyboard?.isRepeating ?? false),
    radius: () => `${shapeRadius(root.dataset.radius, 8, 9999)}px`,
    onFrame: (box) => {
      rules.frame(box);
      marker.frame(box);
      const listener = (root as FrameElement)[frameCallbackProperty];
      if (typeof listener === 'function')
        listener({ y: box.y, height: box.height, opacity: box.opacity }, root);
    },
    onPick: (index) => {
      active = index === null ? undefined : hover.items[index];
      marker.select(active);
      project();
    },
  });
  keyboard = mountRowHighlight(root, hover);
  project();
  const selections = mountSelections(
    root,
    () => rows().filter((row) => row.hasAttribute('data-fluid-hover-index')),
    {
      isSelected: (row) => row.hasAttribute('data-table-selected'),
      attributes: ['data-table-selected'],
      snapAttribute: 'data-snap-key',
      mirrorAttribute: 'data-selection-mirrors',
    },
  );
  layouts.set(root, () => {
    project();
    selections.refresh();
  });
  // A consumer class change makes Foldkit rewrite a row's class attribute,
  // dropping `is-active`; re-projecting restores it. Write only changed classes
  // so this observer never feeds another identical class write back to itself.
  const observer = new MutationObserver((records) => {
    const snapChanged = root.dataset.snapKey !== snapKey;
    if (snapChanged) {
      snapKey = root.dataset.snapKey;
      snapping = true;
      cancelAnimationFrame(snapFrame);
      snapFrame = requestAnimationFrame(() => {
        snapping = false;
      });
    }
    if (
      root.dataset.hover === 'off' &&
      records.some((record) => record.target === root && record.attributeName === 'data-hover')
    )
      hover.leave();
    const holdChanged = records.some(
      (record) => record.target === root && record.attributeName === 'data-hold-row-highlight',
    );
    if (holdChanged) {
      if (root.dataset.holdRowHighlight === 'true') {
        heldSlot = hover.active;
        hover.highlight(heldSlot);
      } else {
        const priorSnap = snapping;
        snapping = true;
        keyboard?.releaseHeldSlot(heldSlot);
        snapping = priorSnap;
        heldSlot = null;
      }
    }
    project();
    // Apply row state before measuring so its styles share the snap layout pass.
    if (snapChanged) hover.measure();
    if (holdChanged && root.dataset.holdRowHighlight === 'false') selections.refresh(true);
  });
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-fluid-hover-index',
      'class',
      'data-hover',
      'data-hold-row-highlight',
      'data-selected-indices',
      'data-keep-rule',
      'data-snap-key',
    ],
  });
  return () => {
    disposed = true;
    layouts.delete(root);
    disposeHead();
    keyboard.dispose();
    marker.dispose();
    rules.dispose();
    cancelAnimationFrame(snapFrame);
    cancelAnimationFrame(rulesFrame);
    root.removeAttribute('data-snap-rules');
    selections();
    viewport.disconnect();
    if (priorWidth) root.style.setProperty('--table-view-w', priorWidth);
    else root.style.removeProperty('--table-view-w');
    observer.disconnect();
    hover.dispose();
    active = undefined;
    project();
  };
}
