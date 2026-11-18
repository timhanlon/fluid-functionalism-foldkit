import { fitColumns, type NaturalColumn, type SizingConfig } from './sizing';

function headerWidth(cell: HTMLElement): number {
  let left = Infinity,
    right = -Infinity;
  const range = document.createRange();
  cell.childNodes.forEach((node) => {
    if (node instanceof HTMLElement) {
      const position = getComputedStyle(node).position;
      if (
        node.hasAttribute('data-resize-column') ||
        position === 'absolute' ||
        position === 'fixed'
      )
        return;
    }
    range.selectNode(node);
    const rect = range.getBoundingClientRect();
    if (rect.width) {
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
    }
  });
  return right > left ? right - left : 0;
}

/** Scoped geometry cache only. Widths are proposed to the reducer; this
 * observer never changes TanStack state or retains an engine instance. */
export function mountColumnSizing(
  root: HTMLElement,
  send: (config: SizingConfig, widths: Record<string, number>) => void,
): () => void {
  let live = true;
  let key: string | undefined;
  let natural: readonly NaturalColumn[] = [];
  let fromRows = false;
  let viewport: HTMLElement | null = null;
  const config = (): SizingConfig | undefined => {
    const value = root.dataset.columnSizing;
    return value ? JSON.parse(value) : undefined;
  };
  const own = (node: Element) => node.closest('.ff-data-table') === root;
  const apply = (current: SizingConfig) => {
    if (!live || !viewport?.clientWidth || !natural.length) return;
    const widths = fitColumns(natural, viewport.clientWidth);
    if (Object.values(widths).every((width) => Number.isFinite(width) && width > 0))
      send(current, widths);
  };
  const read = (fonts = false) => {
    const current = config();
    if (
      !live ||
      !current ||
      document.fonts?.status === 'loading' ||
      (current.resize && current.seeded && !(current.guessed && !current.loading))
    )
      return;
    const table = [...root.querySelectorAll<HTMLTableElement>('.ff-data-table-element')].find(own);
    const nextViewport = table?.closest<HTMLElement>('.ff-data-table-scroll') ?? null;
    if (!table || !nextViewport) return;
    if (viewport !== nextViewport) {
      if (viewport) resize.unobserve(viewport);
      viewport = nextViewport;
      resize.observe(viewport);
    }
    if (current.key === key && !fonts) return;
    const heads = [...table.querySelectorAll<HTMLElement>('thead th[data-column]')].filter(own);
    if (!heads.length) return;
    const keep =
      current.loading &&
      fromRows &&
      natural.length === heads.length &&
      heads.every((head, index) => natural[index]?.id === head.dataset.column);
    if (!keep) {
      const saved = table.style.cssText;
      const cellStyles = [...table.querySelectorAll<HTMLElement>('th,td')]
        .filter(own)
        .map((cell) => ({ cell, style: cell.style.cssText }));
      cellStyles.forEach(({ cell }) => cell.style.removeProperty('min-width'));
      table.style.cssText = 'table-layout:auto;width:max-content;min-width:0';
      table.setAttribute('data-measuring', '');
      try {
        natural = heads.map((head) => {
          const id = head.dataset.column!;
          const definition = current.columns.find((column) => column.id === id)!;
          const css = getComputedStyle(head);
          const padding = (parseFloat(css.paddingLeft) || 0) + (parseFloat(css.paddingRight) || 0);
          let floor = Math.ceil(
            Math.max(headerWidth(head) + padding, parseFloat(css.minWidth) || 0),
          );
          let content = head.getBoundingClientRect().width;
          const cells = [...table.querySelectorAll<HTMLElement>('tbody td[data-column]')].filter(
            (cell) => cell.dataset.column === id && own(cell),
          );
          // An input's value isn't a text node. Read its natural text width
          // as the source's hidden editor sizer does, rather than its CSS 100%.
          for (const cell of cells) {
            for (const input of cell.querySelectorAll<HTMLInputElement>(
              'input:not([type="checkbox"]):not([type="radio"])',
            )) {
              if (!input.value) continue;
              const style = getComputedStyle(input);
              const cellCss = getComputedStyle(cell);
              const sizer = document.createElement('span');
              sizer.style.cssText =
                'position:absolute;width:max-content;white-space:nowrap;visibility:hidden';
              sizer.style.font = style.font;
              sizer.style.letterSpacing = style.letterSpacing;
              sizer.textContent = input.value;
              cell.append(sizer);
              try {
                const pad =
                  (parseFloat(cellCss.paddingLeft) || 0) + (parseFloat(cellCss.paddingRight) || 0);
                content = Math.max(content, sizer.getBoundingClientRect().width + pad);
              } finally {
                sizer.remove();
              }
            }
          }
          if (definition.texts) {
            const sample = cells.find((cell) => cell.querySelector('.ff-data-table-tree-value'));
            const value = sample?.querySelector<HTMLElement>('.ff-data-table-tree-value');
            if (sample && value) {
              const sampleCss = getComputedStyle(sample);
              const sizer = document.createElement('span');
              sizer.style.cssText =
                'position:absolute;width:max-content;white-space:nowrap;visibility:hidden';
              value.append(sizer);
              try {
                const chrome =
                  parseFloat(sampleCss.paddingLeft) + parseFloat(sampleCss.paddingRight) + 28;
                let widestWord = 0;
                for (const text of definition.texts) {
                  sizer.textContent = text;
                  content = Math.max(content, sizer.getBoundingClientRect().width + chrome);
                  for (const word of text.split(/\s+/)) {
                    sizer.textContent = word;
                    widestWord = Math.max(widestWord, sizer.getBoundingClientRect().width);
                  }
                }
                floor = Math.max(floor, Math.ceil(Math.min(widestWord + chrome, 240)));
              } finally {
                sizer.remove();
              }
            }
          }
          if (cells.some((cell) => cell.querySelector('.ff-date-picker')))
            floor = Math.max(floor, Math.ceil(Math.min(content, 240)));
          return {
            id,
            width:
              definition.size ??
              Math.ceil(definition.cap ? Math.max(Math.min(content, 240), floor) : content),
            floor,
            fixed: definition.fixed || definition.size !== undefined,
          };
        });
        fromRows = !current.loading;
      } finally {
        table.removeAttribute('data-measuring');
        table.style.cssText = saved;
        cellStyles.forEach(({ cell, style }) => {
          cell.style.cssText = style;
        });
      }
    }
    key = current.key;
    apply(current);
  };
  const resize = new ResizeObserver(() => {
    const current = config();
    if (current && current.key === key && !current.resize) apply(current);
  });
  const observer = new MutationObserver(() => read());
  observer.observe(root, {
    attributes: true,
    attributeFilter: ['data-column-sizing'],
    childList: true,
  });
  read();
  document.fonts?.ready.then(() => {
    if (live) read(true);
  });
  return () => {
    live = false;
    observer.disconnect();
    resize.disconnect();
  };
}
