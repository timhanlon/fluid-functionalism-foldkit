import { Button as Primitive } from '@foldkit/ui';
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import './styles.css';
export type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'destructive';
export type Size = 'default' | 'compact' | 'icon' | 'icon-compact';
export interface Props<Message> {
  readonly children: readonly (Html | string)[];
  readonly onClick?: Message;
  readonly variant?: Variant;
  readonly size?: Size;
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly active?: boolean;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly label?: string;
  readonly leadingIcon?: Html;
  readonly trailingIcon?: Html;
  readonly className?: string;
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
/** Fluid visuals for a button whose interaction may be owned by another
 * Foldkit UI primitive, such as Menu. The caller supplies the native element. */
export function decoration<Message>(props: Props<Message>, h: HtmlBuilder<Message>) {
  const iconOnly = props.size === 'icon' || props.size === 'icon-compact';
  const iconSize = props.size === 'compact' || props.size === 'icon-compact' ? '14' : '16';
  const content = iconOnly
    ? props.children
    : [
        props.leadingIcon ?? null,
        h.span([h.Class('ff-button-label')], props.children),
        props.trailingIcon ?? null,
      ];
  return {
    attributes: [
      h.Disabled(!!props.disabled || !!props.loading),
      h.Class(`ff-button ${props.className ?? ''}`),
      h.DataAttribute('variant', props.variant ?? 'primary'),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('active', String(!!props.active)),
      h.DataAttribute('loading', String(!!props.loading)),
      h.Attribute('aria-busy', String(!!props.loading)),
      ...(props.label ? [h.AriaLabel(props.label)] : []),
      ...(!iconOnly && props.leadingIcon ? [h.DataAttribute('leading', '')] : []),
      ...(!iconOnly && props.trailingIcon ? [h.DataAttribute('trailing', '')] : []),
      ...(props.attributes ?? []),
    ],
    children: [
      h.span([h.Class('ff-button-background'), h.AriaHidden(true)], []),
      h.span(
        [h.Class('ff-button-content')],
        [
          h.span([h.Class('ff-button-reserved')], content),
          props.loading
            ? h.span(
                [h.Class('ff-button-spinner'), h.AriaHidden(true)],
                [
                  h.svg(
                    [h.Width(iconSize), h.Height(iconSize), h.ViewBox('0 0 16 16'), h.Fill('none')],
                    [
                      h.g(
                        [h.Class('ff-spinner-turn')],
                        [
                          h.circle(
                            [
                              h.Cx('8'),
                              h.Cy('8'),
                              h.R('6.25'),
                              h.Stroke('currentColor'),
                              h.StrokeWidth('1.5'),
                              h.StrokeLinecap('round'),
                              h.Attribute('pathLength', '100'),
                              h.Attribute('transform', 'rotate(-90 8 8)'),
                              h.Class('ff-spinner-breathe'),
                            ],
                            [],
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              )
            : null,
        ],
      ),
    ],
  };
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const visual = decoration(props, h);
  return Primitive.view(
    {
      onClick: props.onClick,
      isDisabled: !!props.disabled || !!props.loading,
      type: props.type ?? 'button',
      toView: ({ button }) => h.button([...button, ...visual.attributes], visual.children),
    },
    h,
  );
}
