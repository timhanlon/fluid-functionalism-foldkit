import { defineSilentMountWithArgs } from '../silent-mount';
import { shapeRadius } from '../shape';
import { Button } from '@foldkit/ui';
import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { mountHover } from '../../fluid-hover/engine';
import { mountListFocus } from '../list-focus';
import './styles.css';
import '../../fluid-hover/styles.css';

const Mounted = defineSilentMountWithArgs('SidebarMenu.Mount', {
  args: { focusRing: Schema.Boolean },
  execute: ({ element, focusRing }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const rows = () =>
          [...element.querySelectorAll<HTMLElement>('.ff-sidebar-menu-button')].filter(
            (row) => row.closest('.ff-sidebar-menu') === element,
          );
        const hover = mountHover(element, {
          itemSelector: '.ff-sidebar-menu-button',
          ownsItem: (item) => item.closest('.ff-sidebar-menu') === element,
          nearest: true,
          axis: 'y',
          selectedAttribute: 'aria-current',
          keyboardNavigation: false,
          radius: () => `${shapeRadius(element.dataset.radius, 8, 20, 1)}px`,
        });
        const disposeFocus = focusRing ? mountListFocus(element, rows) : () => {};
        const key = (event: KeyboardEvent) => {
          const buttons = rows().filter((row) => !row.matches(':disabled,[aria-disabled=true]'));
          const current = buttons.indexOf(event.target as HTMLElement);
          if (current < 0) return;
          const next =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : event.key === 'ArrowDown' || event.key === 'ArrowRight'
                  ? (current + 1) % buttons.length
                  : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
                    ? (current - 1 + buttons.length) % buttons.length
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          event.stopPropagation();
          buttons[next]?.focus();
        };
        element.addEventListener('keydown', key);
        return () => {
          element.removeEventListener('keydown', key);
          disposeFocus();
          hover.dispose();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
export interface Item {
  readonly value: string;
  readonly label: string;
  readonly icon?: Html;
  readonly disabled?: boolean;
}
export interface Props<Message> {
  readonly label: string;
  readonly groupLabel?: string;
  readonly items: readonly Item[];
  readonly value?: string;
  readonly onSelect: (value: string) => Message;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly focusRing?: boolean;
  readonly className?: string;
}
/** A flat list of controlled section buttons. Navigation never selects a row. */
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const selected = props.items.findIndex((item) => item.value === props.value && !item.disabled);
  const tabStop = selected < 0 ? props.items.findIndex((item) => !item.disabled) : selected;
  return h.div(
    [h.Class(`ff-sidebar-group ${props.className ?? ''}`)],
    [
      props.groupLabel ? h.div([h.Class('ff-sidebar-group-label')], [props.groupLabel]) : null,
      h.ul(
        [
          h.Class('ff-sidebar-menu'),
          h.AriaLabel(props.label),
          h.DataAttribute('size', props.size ?? 'default'),
          h.DataAttribute('radius', props.radius ?? 'rounded'),
          h.OnMount(Mounted({ focusRing: props.focusRing !== false })),
        ],
        props.items.map((item, index) =>
          h.li(
            [],
            [
              Button.view(
                {
                  isDisabled: item.disabled,
                  onClick: props.onSelect(item.value),
                  toView: ({ button }) =>
                    h.button(
                      [
                        ...button,
                        h.Class('ff-sidebar-menu-button'),
                        h.Tabindex(index === tabStop ? 0 : -1),
                        ...(item.value === props.value
                          ? [h.Attribute('aria-current', 'page')]
                          : []),
                      ],
                      [
                        item.icon
                          ? h.span(
                              [h.Class('ff-sidebar-menu-icon'), h.AriaHidden(true)],
                              [item.icon],
                            )
                          : null,
                        h.span([h.Class('ff-sidebar-menu-label')], [item.label]),
                      ],
                    ),
                },
                h,
              ),
            ],
          ),
        ),
      ),
    ],
  );
}
