import { animate, type AnimationPlaybackControls } from 'motion';

interface Panel {
  readonly month: string;
  readonly slot: HTMLElement;
  readonly caption: HTMLElement;
  readonly weeks: HTMLElement;
  readonly height: number;
  readonly width: number;
  readonly captionWidth: number;
  readonly stride: number;
}
/** Visual copies have no IDs, live regions, tab stops or hover registration.
 * The declarative live panel remains the sole interaction/accessibility owner. */
function visualCopy(node: HTMLElement): HTMLElement {
  const copy = node.cloneNode(true) as HTMLElement;
  copy.setAttribute('data-calendar-outgoing', '');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  copy.querySelectorAll('[data-calendar-outgoing]').forEach((item) => item.remove());
  for (const item of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
    for (const attribute of [
      'id',
      'aria-live',
      'aria-labelledby',
      'aria-describedby',
      'role',
      'data-calendar-index',
    ])
      item.removeAttribute(attribute);
    if (item.matches('button,input,select,textarea,a,[tabindex]')) item.tabIndex = -1;
  }
  return copy;
}
/** Own only the empty outgoing layers and animation styles. Foldkit owns live
 * caption/week nodes and may replace them at any render. */
export function mountMonthMotion(root: HTMLElement): () => void {
  const reduced = matchMedia('(prefers-reduced-motion:reduce)');
  const motions = new Map<HTMLElement, AnimationPlaybackControls>();
  const leaving = new Set<HTMLElement>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let panels: readonly Panel[] = [],
    month = root.dataset.viewMonth ?? '',
    layout = root.dataset.layout,
    frame = 0,
    disposed = false,
    wasComplete = false;
  let rangeParts: readonly { day: string; band?: HTMLElement; end: boolean }[] = [];
  const animateNode = (
    node: HTMLElement,
    values: Record<string, number | number[]>,
    options: { duration: number; type?: 'spring'; bounce?: number },
    complete?: () => void,
  ) => {
    motions.get(node)?.stop();
    const animation = animate(node, values, {
      ...options,
      onComplete: () => {
        if (motions.get(node) === animation) motions.delete(node);
        complete?.();
      },
    });
    motions.set(node, animation);
  };
  const remove = (node: HTMLElement) => {
    motions.get(node)?.stop();
    motions.delete(node);
    leaving.delete(node);
    node.remove();
  };
  const retire = (node: HTMLElement, delay = 260) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      remove(node);
    }, delay);
    timers.add(timer);
  };
  const read = (): readonly Panel[] => {
    const slots = [
      ...root.querySelectorAll<HTMLElement>('.ff-calendar-strip > .ff-calendar-month'),
    ];
    return slots.flatMap((slot) => {
      const caption = slot.querySelector<HTMLElement>('.ff-calendar-caption-text'),
        weeks = slot.querySelector<HTMLElement>('.ff-calendar-weeks > .ff-calendar-weeks-panel');
      if (!caption || !weeks) return [];
      return [
        {
          month: slot.dataset.month ?? '',
          slot,
          caption,
          weeks,
          height: weeks.offsetHeight,
          width: slot.offsetWidth,
          captionWidth: caption.offsetWidth,
          stride:
            root.dataset.layout === 'vertical' && slots[1]
              ? slots[1].offsetTop - slots[0]!.offsetTop
              : slot.offsetWidth + 24,
        },
      ];
    });
  };
  const reset = () => {
    for (const animation of motions.values()) animation.stop();
    motions.clear();
    for (const node of [...leaving]) remove(node);
    for (const panel of panels) {
      panel.caption.style.transform = '';
      panel.caption.style.opacity = '';
      panel.weeks.style.transform = '';
      panel.weeks.style.opacity = '';
      const wrapper = panel.weeks.parentElement;
      if (wrapper) {
        wrapper.style.height = '';
        wrapper.style.overflowY = '';
      }
    }
  };
  const masks = () => {
    const strip = root.querySelector<HTMLElement>('.ff-calendar-strip'),
      row = root.querySelector<HTMLElement>('.ff-calendar-sticky-weekdays');
    if (strip && row) {
      // Convert the viewport distance back into local CSS pixels when the
      // surrounding preview is scaled.
      const scale = root.offsetWidth ? root.getBoundingClientRect().width / root.offsetWidth : 1;
      const top =
        (row.getBoundingClientRect().bottom - strip.getBoundingClientRect().top) / (scale || 1);
      strip.style.setProperty('--strip-clip-top', `${top}px`);
    }
  };
  const sync = () => {
    if (disposed) return;
    const complete = root.dataset.rangeComplete === 'true';
    if (wasComplete && !complete) {
      for (const part of rangeParts) {
        const cell = root.querySelector<HTMLElement>(
          `.ff-calendar-weeks-panel > .ff-calendar-days > .ff-calendar-week > [data-day="${part.day}"][data-hidden="false"]`,
        );
        if (!cell) continue;
        const ghost = document.createElement('span');
        ghost.className = 'ff-calendar-range-ghost';
        ghost.setAttribute('data-calendar-outgoing', '');
        ghost.setAttribute('data-slot', 'calendar-range-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        if (part.band) ghost.append(part.band.cloneNode(true));
        if (part.end) {
          const end = document.createElement('span');
          end.className = 'ff-calendar-ghost-end';
          ghost.append(end);
        }
        cell.append(ghost);
        leaving.add(ghost);
        animateNode(ghost, { opacity: [1, 0] }, { duration: 0.12 }, () => remove(ghost));
        retire(ghost, 220);
      }
    }
    wasComplete = complete;
    if (complete)
      rangeParts = [
        ...root.querySelectorAll<HTMLElement>(
          '.ff-calendar-weeks-panel > .ff-calendar-days > .ff-calendar-week > .ff-calendar-cell[data-hidden="false"]',
        ),
      ].flatMap((cell) => {
        const band = cell.querySelector<HTMLElement>(':scope > .ff-calendar-band'),
          end = !!cell.querySelector('.ff-calendar-day[data-selected="true"]');
        return band || end
          ? [
              {
                day: cell.dataset.day!,
                band: band?.cloneNode(true) as HTMLElement | undefined,
                end,
              },
            ]
          : [];
      });
    else rangeParts = [];
    const current = read(),
      nextMonth = root.dataset.viewMonth ?? '',
      nextLayout = root.dataset.layout;
    const changed = month !== nextMonth;
    if (layout !== nextLayout) reset();
    if (changed && layout === nextLayout && panels.length === current.length) {
      const direction = nextMonth > month ? 1 : -1,
        single = root.dataset.numberMonths !== '2',
        spring = { type: 'spring' as const, duration: 0.16, bounce: 0 };
      for (const node of [...leaving])
        if (!node.classList.contains('ff-calendar-range-ghost')) remove(node);
      current.forEach((panel, index) => {
        const previous = panels[index]!;
        const distance = reduced.matches ? 0 : previous.stride * (single ? 1 / 3 : 1);
        const axis = nextLayout === 'vertical' ? 'y' : 'x';
        const fade = single || reduced.matches;
        for (const part of ['caption', 'weeks'] as const) {
          const incoming = panel[part],
            old = previous[part];
          if (incoming === old) continue;
          const holder = panel.slot.querySelector<HTMLElement>(
            part === 'caption' ? '.ff-calendar-caption-outgoing' : '.ff-calendar-weeks-outgoing',
          );
          // A month leaving one slot may also be entering another. Only its
          // incoming instance paints, so the shared carousel path stays solid.
          if (holder && !current.some((item) => item.month === previous.month)) {
            const copy = visualCopy(old);
            copy.style.width = `${part === 'weeks' ? previous.width : previous.captionWidth}px`;
            // Detached nodes lose layout measurements; the cached panel height
            // and live slot width preserve the departing frame.
            if (part === 'weeks') copy.style.height = `${previous.height}px`;
            holder.append(copy);
            leaving.add(copy);
            animateNode(
              copy,
              { [axis]: -direction * distance, opacity: fade ? 0 : 1 },
              reduced.matches ? { duration: 0.12 } : spring,
              () => remove(copy),
            );
            retire(copy);
          }
          animateNode(
            incoming,
            { [axis]: [direction * distance, 0], opacity: fade ? [0, 1] : [1, 1] },
            spring,
          );
        }
        const wrapper = panel.weeks.parentElement;
        if (wrapper && previous.height !== panel.height && !reduced.matches) {
          wrapper.style.overflowY = nextLayout === 'vertical' ? '' : 'clip';
          animateNode(
            wrapper,
            {
              height: [wrapper.style.height ? wrapper.offsetHeight : previous.height, panel.height],
            },
            spring,
            () => {
              wrapper.style.height = '';
              wrapper.style.overflowY = '';
            },
          );
        }
      });
    }
    for (const panel of current)
      panel.slot.style.setProperty('--calendar-stride', `${panel.stride}px`);
    panels = current;
    month = nextMonth;
    layout = nextLayout;
    masks();
  };
  const scheduleMask = () => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        masks();
      });
  };
  const observer = new MutationObserver((records) => {
    // Imperative outgoing nodes trigger child-list records too. Only live
    // render changes can start a new transition.
    if (
      records.some(
        (record) =>
          !(record.target instanceof Element) || !record.target.closest('[data-calendar-outgoing]'),
      )
    )
      sync();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      'data-view-month',
      'data-layout',
      'data-size',
      'data-fill',
      'data-cell-size',
      'data-number-months',
      'data-range-complete',
    ],
  });
  const resize = new ResizeObserver(sync);
  resize.observe(root);
  const reduce = () => {
    reset();
    sync();
  };
  reduced.addEventListener('change', reduce);
  window.addEventListener('scroll', scheduleMask, { capture: true, passive: true });
  window.addEventListener('resize', scheduleMask);
  sync();
  return () => {
    disposed = true;
    observer.disconnect();
    resize.disconnect();
    cancelAnimationFrame(frame);
    reduced.removeEventListener('change', reduce);
    window.removeEventListener('scroll', scheduleMask, true);
    window.removeEventListener('resize', scheduleMask);
    reset();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
}
