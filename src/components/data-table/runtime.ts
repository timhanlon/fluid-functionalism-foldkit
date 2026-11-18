import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { DragAndDrop } from '@foldkit/ui';
import { animate, type AnimationPlaybackControls } from 'motion';
import { spring } from '../motion';
import { Message } from './state';
import { mountExpansion } from './expansion';
import { mountSortArrows } from './sort-arrows';
import { mountColumnSizing } from './sizing-runtime';

type RuntimeMessage = Extract<
  Message,
  {
    _tag:
      | 'ColumnResized'
      | 'ColumnsMeasured'
      | 'RowActivated'
      | 'RowSelected'
      | 'RowExpanded'
      | 'RowMoved'
      | 'RowDrag'
      | 'ColumnDrag'
      | 'ContextRequested'
      | 'EditStarted'
      | 'EditEnded'
      | 'Undo'
      | 'Redo'
      | 'ActionsOpened'
      | 'ColumnMoved'
      | 'LinkEditStarted';
  }
>;
/** Native event/geometry work belongs to this scoped Mount. It proposes
 * Messages; the reducer remains the only owner of table state. */
export const Mounted = Mount.defineStream('DataTable.Native', {
  messages: [
    Message.ColumnResized,
    Message.ColumnsMeasured,
    Message.RowActivated,
    Message.RowSelected,
    Message.RowExpanded,
    Message.RowMoved,
    Message.RowDrag,
    Message.ColumnDrag,
    Message.ContextRequested,
    Message.EditStarted,
    Message.EditEnded,
    Message.Undo,
    Message.Redo,
    Message.ActionsOpened,
    Message.ColumnMoved,
    Message.LinkEditStarted,
  ],
  execute: ({ element }) =>
    Stream.callback<RuntimeMessage>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          element instanceof HTMLElement
            ? mountTable(element, (message) => Queue.offerUnsafe(queue, message))
            : () => {},
        ),
        (dispose) => Effect.sync(dispose),
      ),
    ),
});
export function mountTable(root: HTMLElement, send: (message: RuntimeMessage) => void): () => void {
  const expansion = mountExpansion(root);
  const disposeSizing = mountColumnSizing(root, (config, widths) =>
    send(
      Message.ColumnsMeasured({
        generation: config.generation,
        size: config.size,
        key: config.key,
        widths,
      }),
    ),
  );
  const disposeSortArrows = mountSortArrows(root);
  const owns = (element: Element) => element.closest('.ff-data-table') === root;
  const control =
    'button,a,input,textarea,select,[role="combobox"],[role="checkbox"],[role="menuitem"],[contenteditable="true"]';
  let pressedControl = false;
  let headerClick: ReturnType<typeof setTimeout> | undefined;
  let resizing:
    | { id: string; origin: number; width: number; pointer: number; handle: HTMLElement }
    | undefined;
  const down = (event: PointerEvent) => {
    if (!(event.target instanceof Element) || !owns(event.target)) return;
    pressedControl = !!event.target.closest(control);
    const drag = event.target.closest<HTMLElement>('[data-draggable-id]');
    const surface = drag?.closest<HTMLElement>('th,tr');
    if (surface) {
      const rect = surface.getBoundingClientRect();
      root.dataset.dragOffsetX = String(event.clientX - rect.left);
      root.dataset.dragOffsetY = String(event.clientY - rect.top);
      root.dataset.dragOriginY = String(event.clientY);
      root.dataset.dragOriginX = String(event.clientX);
    }
    const handle = event.target.closest<HTMLElement>('[data-resize-column]');
    if (!handle || event.button !== 0) return;
    const cell = handle.closest('th');
    if (!cell) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    handle.setAttribute('data-resizing', '');
    resizing = {
      id: handle.dataset.resizeColumn!,
      origin: event.clientX,
      width: cell.getBoundingClientRect().width,
      pointer: event.pointerId,
      handle,
    };
  };
  const move = (event: PointerEvent) => {
    if (!resizing || event.pointerId !== resizing.pointer) return;
    send(
      Message.ColumnResized({
        columnId: resizing.id,
        width: resizing.width + event.clientX - resizing.origin,
      }),
    );
  };
  const up = () => {
    if (resizing?.handle.hasPointerCapture(resizing.pointer))
      resizing.handle.releasePointerCapture(resizing.pointer);
    resizing?.handle.removeAttribute('data-resizing');
    resizing = undefined;
  };
  const cancelled = (event: PointerEvent) => {
    up();
    if (!(event.target instanceof Element) || !owns(event.target)) return;
    const surface = event.target.closest('[data-draggable-id]')?.closest('th,tr');
    if (!surface) return;
    const payload = {
      generation: Number(root.dataset.generation ?? 0),
      message: DragAndDrop.Message.CancelledDrag(),
    };
    // The browser cancels the original handle; the SDK owns the transition.
    send(surface.tagName === 'TH' ? Message.ColumnDrag(payload) : Message.RowDrag(payload));
  };
  const click = (event: MouseEvent) => {
    // Releasing outside a control can synthesize a click on its row ancestor.
    // The row never owned that press (including a cancelled handle drag).
    if (event.detail > 0 && pressedControl) {
      pressedControl = false;
      return;
    }
    if (!(event.target instanceof Element) || !owns(event.target) || event.target.closest(control))
      return;
    const head = event.target.closest('th[data-head-action]');
    if (head && !event.target.closest('[data-resize-column]')) {
      const trigger = head.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
      if (trigger) {
        trigger.focus({ preventScroll: true });
        const shiftKey = event.shiftKey;
        clearTimeout(headerClick);
        // Open through the primitive's native trigger after this click ends,
        // so the same click cannot dismiss the newly opened popup.
        headerClick = setTimeout(() => {
          headerClick = undefined;
          if (root.contains(trigger))
            trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey }));
        }, 0);
      }
      return;
    }
    const link = event.target.closest<HTMLElement>('[data-link-editor]');
    if (link) {
      const [rowId, columnId] = JSON.parse(link.dataset.linkEditor!) as [string, string];
      send(Message.LinkEditStarted({ rowId, columnId }));
      return;
    }
    const row = event.target.closest<HTMLElement>('tr[data-row-id]');
    if (row && root.dataset.rowClickable === 'true')
      send(Message.RowActivated({ rowId: row.dataset.rowId! }));
    else if (row?.dataset.selectable === 'true')
      send(
        Message.RowSelected({
          rowId: row.dataset.rowId!,
          selected: row.dataset.selected !== 'true',
          range: event.shiftKey,
        }),
      );
  };
  const context = (event: MouseEvent | KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      !(event.target instanceof HTMLElement) ||
      !owns(event.target) ||
      event.target.closest('input,textarea,[contenteditable]') ||
      root.dataset.rowActions !== 'true'
    )
      return;
    const row = event.target.closest<HTMLElement>('tr[data-row-id]');
    if (!row) return;
    event.preventDefault();
    const rect = event.target.getBoundingClientRect();
    const active = document.activeElement;
    send(
      Message.ContextRequested({
        rowId: row.dataset.rowId!,
        x: event instanceof MouseEvent ? event.clientX : rect.left + 8,
        y: event instanceof MouseEvent ? event.clientY : rect.bottom,
        returnFocusId: active instanceof HTMLElement && active.id ? active.id : row.id,
      }),
    );
  };
  const headerKey = (event: KeyboardEvent) => {
    if (
      !event.altKey ||
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
      !(event.target instanceof Element) ||
      !owns(event.target)
    )
      return;
    const header = event.target.closest<HTMLElement>('th[data-column]');
    if (!header || root.dataset.reorderColumns !== 'true') return;
    event.preventDefault();
    event.stopPropagation();
    send(
      Message.ColumnMoved({
        columnId: header.dataset.column!,
        direction: event.key === 'ArrowLeft' ? -1 : 1,
      }),
    );
  };
  const key = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement) || !owns(event.target)) return;
    const link = event.target.closest<HTMLElement>('[data-link-editor]');
    if (event.key === 'F2' && link) {
      event.preventDefault();
      const [rowId, columnId] = JSON.parse(link.dataset.linkEditor!) as [string, string];
      send(Message.LinkEditStarted({ rowId, columnId }));
      return;
    }
    const inEditor = event.target.closest('input,textarea,[contenteditable="true"]');
    if (inEditor) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.target.blur();
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.altKey) {
      if (event.key.toLowerCase() === 'k' && Number(root.dataset.selectedCount) > 0) {
        event.preventDefault();
        event.stopPropagation();
        send(Message.ActionsOpened());
        return;
      }
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        send(event.shiftKey ? Message.Redo() : Message.Undo());
        return;
      }
      if (event.key.toLowerCase() === 'y') {
        event.preventDefault();
        send(Message.Redo());
        return;
      }
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      context(event);
      return;
    }
    const current = event.target.closest<HTMLElement>('tr[data-row-id]');
    if (!current || event.target !== current) return;
    const surface = current.closest<HTMLElement>('.ff-table');
    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      surface?.dataset.rowReorder === 'true' &&
      current.dataset.depth === '0' &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      event.preventDefault();
      send(
        Message.RowMoved({
          rowId: current.dataset.rowId!,
          direction: event.key === 'ArrowUp' ? -1 : 1,
        }),
      );
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rows = [...root.querySelectorAll<HTMLElement>('tr[data-row-id]')].filter(owns);
    const focusRow = (target: HTMLElement | undefined) => {
      if (!target) return;
      event.preventDefault();
      rows.forEach((row) => {
        row.tabIndex = row === target ? 0 : -1;
      });
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };
    if (!event.shiftKey && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      const expanded = current.dataset.expanded === 'true';
      if (event.key === 'ArrowRight') {
        if (current.dataset.expandable === 'true' && !expanded) {
          event.preventDefault();
          send(Message.RowExpanded({ rowId: current.dataset.rowId!, expanded: true }));
        } else if (
          expanded &&
          Number(rows[rows.indexOf(current) + 1]?.dataset.depth) > Number(current.dataset.depth)
        )
          focusRow(rows[rows.indexOf(current) + 1]);
      } else if (expanded) {
        event.preventDefault();
        send(Message.RowExpanded({ rowId: current.dataset.rowId!, expanded: false }));
      } else if (current.dataset.parentId)
        focusRow(rows.find((row) => row.dataset.rowId === current.dataset.parentId));
      return;
    }
    if (
      !event.repeat &&
      surface?.dataset.selectionColumn === 'true' &&
      (event.key.toLowerCase() === 'x' || event.key === 'Enter')
    ) {
      event.preventDefault();
      send(
        Message.RowSelected({
          rowId: current.dataset.rowId!,
          selected: current.dataset.selected !== 'true',
          range: event.shiftKey,
        }),
      );
      return;
    }
    if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      if (root.dataset.rowClickable === 'true') {
        event.preventDefault();
        send(Message.RowActivated({ rowId: current.dataset.rowId! }));
      } else if (event.key === ' ' && current.dataset.selectable === 'true') {
        event.preventDefault();
        send(
          Message.RowSelected({
            rowId: current.dataset.rowId!,
            selected: current.dataset.selected !== 'true',
            range: event.shiftKey,
          }),
        );
      } else if (current.dataset.expandable === 'true') {
        event.preventDefault();
        send(
          Message.RowExpanded({
            rowId: current.dataset.rowId!,
            expanded: current.dataset.expanded !== 'true',
          }),
        );
      }
      return;
    }
    const index = rows.indexOf(current);
    const target =
      event.key === 'ArrowDown'
        ? rows[Math.min(rows.length - 1, index + 1)]
        : event.key === 'ArrowUp'
          ? rows[Math.max(0, index - 1)]
          : event.key === 'Home'
            ? rows[0]
            : event.key === 'End'
              ? rows.at(-1)
              : undefined;
    if (target) {
      event.preventDefault();
      focusRow(target);
      if (event.shiftKey && target.dataset.selectable === 'true') {
        if (current.dataset.selected !== 'true')
          send(Message.RowSelected({ rowId: current.dataset.rowId!, selected: true }));
        send(Message.RowSelected({ rowId: target.dataset.rowId!, selected: true, range: true }));
      }
    }
  };
  const focus = (event: FocusEvent) => {
    if (
      event.target instanceof Element &&
      owns(event.target) &&
      event.target.closest(
        'tbody input,tbody textarea,tbody [role="combobox"],tbody button[aria-haspopup]',
      )
    )
      send(Message.EditStarted());
  };
  const blur = (event: FocusEvent) => {
    if (
      event.relatedTarget instanceof Element &&
      root.contains(event.relatedTarget) &&
      event.relatedTarget.closest(
        'tbody input,tbody textarea,tbody [role=combobox],tbody button[aria-haspopup]',
      )
    )
      return;
    // A Listbox/Calendar portal owns focus while open. Its close messages
    // release the edit hold in update; ordinary fields release it here.
    if (event.target instanceof Element && owns(event.target)) send(Message.EditEnded());
  };
  const positions = new Map<HTMLElement, { x: number; y: number }>();
  const animations = new Set<AnimationPlaybackControls>();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let layoutFrame = 0;
  const capture = (play = false) => {
    const items = [
      ...root.querySelectorAll<HTMLElement>('th[data-column],td[data-column],tr[data-row-id]'),
    ].filter((node) => !node.closest('.ff-data-table-closing'));
    const live = new Set(items);
    for (const node of positions.keys()) if (!live.has(node)) positions.delete(node);
    for (const node of items) {
      const old = positions.get(node),
        next = { x: node.offsetLeft, y: node.offsetTop };
      positions.set(node, next);
      if (
        play &&
        old &&
        !expansion.pending() &&
        !reduced.matches &&
        !resizing &&
        (old.x !== next.x || old.y !== next.y)
      ) {
        const animation = animate(
          node,
          { x: [old.x - next.x, 0], y: [old.y - next.y, 0] },
          spring.moderate,
        );
        animations.add(animation);
        void animation.finished.then(() => animations.delete(animation));
      }
    }
  };
  const layout = new MutationObserver(() => {
    if (!layoutFrame)
      layoutFrame = requestAnimationFrame(() => {
        layoutFrame = 0;
        capture(true);
      });
  });
  layout.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-lines'],
  });
  const scrolled = () => capture();
  window.addEventListener('scroll', scrolled, { capture: true, passive: true });
  capture();
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', cancelled);
  root.addEventListener('click', click);
  root.addEventListener('contextmenu', context);
  root.addEventListener('keydown', key);
  root.addEventListener('keydown', headerKey, true);
  root.addEventListener('focusin', focus);
  root.addEventListener('focusout', blur);
  return () => {
    expansion.dispose();
    disposeSortArrows();
    disposeSizing();
    clearTimeout(headerClick);
    up();
    cancelAnimationFrame(layoutFrame);
    layout.disconnect();
    animations.forEach((animation) => animation.stop());
    window.removeEventListener('scroll', scrolled, { capture: true });
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointermove', move);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', cancelled);
    root.removeEventListener('click', click);
    root.removeEventListener('contextmenu', context);
    root.removeEventListener('keydown', key);
    root.removeEventListener('keydown', headerKey, true);
    root.removeEventListener('focusin', focus);
    root.removeEventListener('focusout', blur);
  };
}
