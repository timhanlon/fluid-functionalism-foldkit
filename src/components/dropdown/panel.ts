import { Button, Checkbox } from '@foldkit/ui';
import { Mount } from 'foldkit';
import type { Attribute, Html, HtmlBuilder } from 'foldkit/html';
import { Leading } from '../popup/leading';
import { Mounted, rowContent } from '../popup';
import type { Item } from './index';
import './styles.css';

export type Selection =
  | { readonly mode: 'none' }
  | { readonly mode: 'single'; readonly value?: string }
  | { readonly mode: 'multiple'; readonly values: readonly string[] };
export interface Props<Message> {
  readonly id: string;
  readonly label: string;
  readonly items: readonly Item[];
  readonly renderLeading?: (item: Item, index: number) => Html | null;
  readonly selection: Selection;
  readonly onSelect: (value: string) => Message;
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly size?: 'default' | 'compact';
  readonly className?: string;
}

/** A static group, with no trigger, portal, or popup-menu claim. */
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const children: Html[] = [];
  const row = (
    item: Item,
    attributes: readonly Attribute<Message>[],
    content: Html,
    leading: Html | null | undefined,
    checked?: boolean,
  ) => {
    if (!leading)
      return h.button([...attributes, h.Class('ff-popup-row'), h.AriaLabel(item.label)], [content]);
    // The full-row native action and the leading control are siblings: arbitrary
    // leading Html must never become interactive content nested in a button.
    return h.div(
      [
        h.Class('ff-popup-row ff-dropdown-panel-leading-row'),
        ...(item.disabled ? [h.DataAttribute('disabled', '')] : []),
        ...(checked === undefined ? [] : [h.DataAttribute('selected', String(checked))]),
      ],
      [
        h.button(
          [
            ...attributes,
            h.Class('ff-dropdown-panel-action'),
            h.DataAttribute('popup-row-control', ''),
            h.AriaLabel(item.label),
          ],
          [content],
        ),
        h.span([h.Class('ff-popup-row-leading'), h.OnMount(Leading())], [leading]),
      ],
    );
  };
  let group: string | undefined;
  props.items.forEach((item, index) => {
    if (group !== item.group) {
      if (index > 0) children.push(h.div([h.Class('ff-popup-separator'), h.Role('separator')], []));
      const label = item.groupLabel ?? item.group;
      if (label) children.push(h.span([h.Class('ff-popup-heading')], [label]));
      group = item.group;
    }
    const leading = props.renderLeading?.(item, index) ?? item.leading;
    if (props.selection.mode === 'none') {
      children.push(
        Button.view(
          {
            isDisabled: item.disabled,
            onClick: props.onSelect(item.value),
            toView: ({ button }) =>
              row(item, button, rowContent({ ...item, leading: undefined }, h), leading),
          },
          h,
        ),
      );
    } else {
      const checked =
        props.selection.mode === 'single'
          ? props.selection.value === item.value
          : props.selection.values.includes(item.value);
      children.push(
        Checkbox.view(
          {
            id: `${props.id}-item-${index}`,
            isChecked: checked,
            isDisabled: item.disabled,
            onToggle: () => props.onSelect(item.value),
            toView: ({ checkbox }) =>
              row(
                item,
                checkbox,
                h.span(
                  [
                    h.Id(Checkbox.labelId(`${props.id}-item-${index}`)),
                    h.Class('ff-popup-row-content'),
                  ],
                  [rowContent({ ...item, leading: undefined, check: true }, h)],
                ),
                leading,
                checked,
              ),
          },
          h,
        ),
      );
    }
  });
  return h.div(
    [
      h.Class(`ff-popup ff-dropdown-panel ${props.className ?? ''}`),
      h.Role('group'),
      h.AriaLabel(props.label),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius === 'sharp' ? 'sharp' : 'rounded'),
      h.DataAttribute('selection', props.selection.mode),
    ],
    [
      h.div(
        [h.Class('ff-popup-viewport ff-dropdown-panel-viewport'), h.OnMount(Mounted())],
        children,
      ),
    ],
  );
}
