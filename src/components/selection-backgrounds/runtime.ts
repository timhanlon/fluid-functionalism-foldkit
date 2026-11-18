import { shapeRadius } from '../shape';
import { animate, type AnimationPlaybackControls } from 'motion';
import {
  assignRuns,
  findBoundaries,
  projectBlocks,
  validBoundary,
  type Boundary,
  type Runs,
} from './state';
import type { ItemRect } from '../../fluid-hover/geometry';
import './styles.css';
import { resolveMirrors } from './mirrors';

interface SelectionOptions {
  readonly isSelected?: (row: HTMLElement) => boolean;
  readonly attributes?: readonly string[];
  /** A changed visual-layout key discards old fills without exit motion. */
  readonly snapAttribute?: string;
  readonly mirrorAttribute?: string;
}
interface SelectionEntry {
  node: HTMLDivElement;
  mirrors: Map<HTMLElement, HTMLDivElement>;
  animations: Map<HTMLElement, AnimationPlaybackControls[]>;
  exitInstant?: boolean;
  exiting?: boolean;
  exitToken?: object;
}
/** A scoped visual projection. Checked state remains owned by Foldkit. */
export function mountSelections(
  root: HTMLElement,
  getRows: () => readonly HTMLElement[],
  options: SelectionOptions = {},
) {
  const isSelected =
    options.isSelected ??
    ((row: HTMLElement) =>
      row.getAttribute('aria-checked') === 'true' ||
      row.getAttribute('aria-selected') === 'true' ||
      row.dataset.selected === 'true');
  const snapKey = () => (options.snapAttribute ? root.getAttribute(options.snapAttribute) : null);
  let lastSnap = snapKey(),
    snapping = false;
  let ids: Runs = { runs: [], byRow: new Map(), lastId: 0 },
    signature = '';
  let boundaries: Boundary[] = [];
  const timers = new Map<Boundary, ReturnType<typeof setTimeout>>();
  const frames = new Set<number>();
  const nodes = new Map<number, SelectionEntry>();
  let mirrorHosts: readonly HTMLElement[] = [];
  let hostObserver: MutationObserver | undefined,
    observingHosts = false;
  const stop = (entry: SelectionEntry, node?: HTMLElement) => {
    for (const [target, animations] of entry.animations) {
      if (node && target !== node) continue;
      animations.forEach((animation) => animation.stop());
      entry.animations.delete(target);
    }
  };
  const remove = (entry: SelectionEntry) => {
    entry.exitToken = undefined;
    stop(entry);
    entry.node.remove();
    entry.mirrors.forEach((node) => node.remove());
    entry.mirrors.clear();
  };
  const reconcileMirrors = (entry: SelectionEntry, hosts: readonly HTMLElement[], add: boolean) => {
    for (const [host, node] of entry.mirrors)
      if (!hosts.includes(host)) {
        stop(entry, node);
        node.remove();
        entry.mirrors.delete(host);
      }
    if (!add) return;
    for (const host of hosts)
      if (!entry.mirrors.has(host)) {
        const node = entry.node.cloneNode(false) as HTMLDivElement;
        node.setAttribute('data-selection-mirror', '');
        host.append(node);
        entry.mirrors.set(host, node);
      }
  };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clear = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    frames.forEach(cancelAnimationFrame);
    frames.clear();
    nodes.forEach((entry) => {
      entry.exiting = false;
      remove(entry);
    });
    nodes.clear();
    boundaries = [];
    ids = { runs: [], byRow: new Map(), lastId: 0 };
    signature = '';
  };
  const frame = (f: () => void) => {
    const id = requestAnimationFrame(() => {
      frames.delete(id);
      f();
    });
    frames.add(id);
  };
  const paint = (restoring = false) => {
    const mirrors = options.mirrorAttribute
      ? resolveMirrors(root, options.mirrorAttribute)
      : { hosts: [], enabled: false };
    const hosts = mirrors.hosts;
    mirrorHosts = hosts;
    if (hostObserver && mirrors.enabled !== observingHosts) {
      observingHosts = mirrors.enabled;
      if (observingHosts)
        hostObserver.observe(root.getRootNode(), {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['id'],
        });
      else hostObserver.disconnect();
    }
    if (ids.runs.length === 0 && nodes.size === 0) return;
    const rects: ItemRect[] = getRows().map((row) => {
      // Layout coordinates match absolute children and stay independent of transforms.
      // Visual bounds divided by offsetHeight also misread fractional layout as scaling.
      let top = row.offsetTop,
        left = row.offsetLeft,
        ancestor = row.offsetParent;
      while (ancestor instanceof HTMLElement && ancestor !== root && root.contains(ancestor)) {
        top += ancestor.offsetTop + ancestor.clientTop;
        left += ancestor.offsetLeft + ancestor.clientLeft;
        ancestor = ancestor.offsetParent;
      }
      return { top, left, width: row.offsetWidth, height: row.offsetHeight };
    });
    const blocks = projectBlocks(
      ids.runs,
      rects,
      shapeRadius(root.dataset.radius, 8, 16),
      boundaries,
    );
    const active = new Set(blocks.map((b) => b.id));
    for (const b of blocks) {
      let entry = nodes.get(b.id);
      const fresh = !entry;
      if (!entry) {
        const node = document.createElement('div');
        node.className = 'ff-selection-background';
        node.setAttribute('data-selection-run', String(b.id));
        node.setAttribute('aria-hidden', 'true');
        if (restoring && !snapping && !reduced.matches) {
          node.setAttribute('data-selection-restored', '');
          node.addEventListener(
            'animationend',
            () => {
              node.removeAttribute('data-selection-restored');
              for (const mirror of nodes.get(b.id)?.mirrors.values() ?? [])
                mirror.removeAttribute('data-selection-restored');
            },
            { once: true },
          );
        }
        root.prepend(node);
        entry = { node, mirrors: new Map(), animations: new Map() };
        nodes.set(b.id, entry);
      }
      stop(entry);
      entry.exiting = false;
      entry.exitToken = undefined;
      entry.exitInstant = snapping || b.exitInstant;
      reconcileMirrors(entry, hosts, true);
      const corners = (r: readonly [number, number, number, number]) => ({
        borderTopLeftRadius: r[0],
        borderTopRightRadius: r[1],
        borderBottomRightRadius: r[2],
        borderBottomLeftRadius: r[3],
      });
      const geometry = {
        top: b.top,
        left: b.left,
        width: b.width,
        height: b.height,
        opacity: b.opacity ?? 1,
      };
      const set = (values: Record<string, number>) => {
        for (const node of [entry!.node, ...entry!.mirrors.values()])
          for (const [key, value] of Object.entries(values))
            (node.style as unknown as Record<string, string>)[key] =
              key === 'opacity' ? String(value) : `${value}px`;
      };
      if (fresh)
        set({
          ...geometry,
          ...corners(b.enterFrom?.radii ?? b.radii),
          ...(b.enterFrom ? { top: b.enterFrom.top, height: b.enterFrom.height } : {}),
        });
      if (snapping || b.instant || reduced.matches || (fresh && !b.enterFrom))
        set({ ...geometry, ...corners(b.radii) });
      else {
        for (const node of [entry.node, ...entry.mirrors.values()]) {
          const { opacity, ...bounds } = geometry;
          const restoringFill = node.hasAttribute('data-selection-restored');
          if (restoringFill) node.style.opacity = String(opacity);
          entry.animations.set(node, [
            animate(node, restoringFill ? bounds : geometry, {
              type: 'spring',
              duration: 0.16,
              bounce: 0,
              opacity: { duration: 0.08 },
            }),
            animate(node, corners(b.radii), {
              type: 'spring',
              duration: 0.16,
              bounce: 0,
              delay: b.cornerDelay ?? 0,
            }),
          ]);
        }
      }
    }
    for (const [id, entry] of nodes) {
      if (!active.has(id)) reconcileMirrors(entry, hosts, false);
      if (active.has(id) || entry.exiting) continue;
      entry.exiting = true;
      stop(entry);
      if (entry.exitInstant || reduced.matches) {
        remove(entry);
        nodes.delete(id);
      } else {
        const exits = [entry.node, ...entry.mirrors.values()].map((node) => {
          const animation = animate(node, { opacity: 0 }, { duration: 0.12 });
          entry.animations.set(node, [animation]);
          return animation;
        });
        const token = {};
        entry.exitToken = token;
        void exits[0]!.then(() => {
          if (entry.exiting && entry.exitToken === token && nodes.get(id) === entry) {
            remove(entry);
            nodes.delete(id);
          }
        });
      }
    }
  };
  const sync = (restoring = false) => {
    const nextSnap = snapKey();
    if (nextSnap !== lastSnap) {
      lastSnap = nextSnap;
      clear();
      snapping = true;
      frame(() => {
        snapping = false;
        paint();
      });
    }
    const selected = getRows().flatMap((row, i) => (isSelected(row) ? [i] : [])),
      next = selected.join(',');
    if (next !== signature) {
      const old = ids;
      ids = assignRuns(selected, ids);
      signature = next;
      boundaries = boundaries.filter((b) => {
        const valid = validBoundary(b, ids.runs);
        if (!valid) {
          clearTimeout(timers.get(b));
          timers.delete(b);
        }
        return valid;
      });
      const found = findBoundaries(old.runs, ids.runs);
      boundaries.push(...found);
      for (const b of found) {
        timers.set(
          b,
          setTimeout(
            () => {
              timers.delete(b);
              if (b.kind === 'merge') {
                b.phase = 'commit';
                paint();
                frame(() => {
                  boundaries = boundaries.filter((x) => x !== b);
                  paint();
                });
              } else {
                boundaries = boundaries.filter((x) => x !== b);
                paint();
              }
            },
            b.kind === 'merge' ? 310 : 240,
          ),
        );
      }
      paint(restoring);
      if (found.some((b) => b.kind === 'split'))
        frame(() => {
          found.forEach((b) => {
            if (b.kind === 'split') b.phase = 'diverge';
          });
          paint();
        });
    } else paint();
  };
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          record.type === 'attributes' ||
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches('[aria-checked],[aria-selected],[data-selected]') ||
                node.querySelector('[aria-checked],[aria-selected],[data-selected]')),
          ),
      )
    )
      sync();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'aria-checked',
      'aria-selected',
      'data-selected',
      'data-size',
      'data-radius',
      ...(options.attributes ?? []),
      ...(options.snapAttribute ? [options.snapAttribute] : []),
      ...(options.mirrorAttribute ? [options.mirrorAttribute] : []),
    ],
  });
  const resize = new ResizeObserver(() => sync());
  resize.observe(root);
  getRows().forEach((row) => resize.observe(row));
  hostObserver = options.mirrorAttribute
    ? new MutationObserver((records) => {
        if (
          records.some(
            (record) =>
              record.type === 'attributes' ||
              [...record.addedNodes, ...record.removedNodes].some(
                (node) => node instanceof Element,
              ),
          )
        ) {
          const targets = resolveMirrors(root, options.mirrorAttribute!).hosts;
          if (
            targets.length !== mirrorHosts.length ||
            targets.some((host, i) => host !== mirrorHosts[i])
          )
            sync();
        }
      })
    : undefined;
  sync();
  return Object.assign(
    () => {
      observer.disconnect();
      resize.disconnect();
      hostObserver?.disconnect();
      clear();
    },
    {
      refresh: (restoring = false) => {
        // An explicit layout refresh reads the latest DOM and selection together.
        observer.takeRecords();
        sync(restoring);
      },
    },
  );
}
