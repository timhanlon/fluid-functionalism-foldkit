import { Button, Checkbox } from '@foldkit/ui';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
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
  readonly selection: Selection;
  readonly onSelect: (value: string) => Message;
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly size?: 'default' | 'compact';
  readonly className?: string;
}

/** A static group, with no trigger, portal, or popup-menu claim. */
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const children: Html[] = [];
  const rowAttributes = (item: Item) => [h.AriaLabel(item.label)];
  let group: string | undefined;
  props.items.forEach((item, index) => {
    if (group !== item.group) {
      if (index > 0) children.push(h.div([h.Class('ff-popup-separator'), h.Role('separator')], []));
      if (item.group) children.push(h.span([h.Class('ff-popup-heading')], [item.group]));
      group = item.group;
    }
    if (props.selection.mode === 'none') {
      children.push(
        Button.view(
          {
            isDisabled: item.disabled,
            onClick: props.onSelect(item.value),
            toView: ({ button }) =>
              h.button(
                [
                  ...button,
                  h.Class('ff-popup-row'),
                  ...rowAttributes(item),
                  ...(item.disabled ? [h.AriaDisabled(true)] : []),
                ],
                [rowContent(item, h)],
              ),
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
              h.button(
                [...checkbox, h.Class('ff-popup-row'), ...rowAttributes(item)],
                [
                  h.span(
                    [
                      h.Id(Checkbox.labelId(`${props.id}-item-${index}`)),
                      h.Class('ff-popup-row-content'),
                    ],
                    [rowContent({ ...item, check: true }, h)],
                  ),
                ],
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
