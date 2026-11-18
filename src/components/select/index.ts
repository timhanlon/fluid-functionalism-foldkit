import { Option } from 'effect';
import { Listbox as Primitive } from '@foldkit/ui';
import { Submodel } from 'foldkit';
import type { Html } from 'foldkit/html';
import { childAttributes } from 'foldkit/html';
import { Model, Message } from './state';
import { Mounted, rowContent } from '../popup';
import './styles.css';
export { Model, Message, init, update, Acknowledge, type OutMessage } from './state';
/** The primitive owns the trigger id used by its focus commands. */
export const triggerId = (model: Model): string => Primitive.buttonId(model.listbox.id);
export interface Item {
  readonly value: string;
  readonly label: string;
  readonly icon?: Html;
  readonly disabled?: boolean;
  readonly group?: string;
}
export interface Props {
  readonly items: readonly Item[];
  readonly value?: string;
  readonly label: string;
  readonly placeholder?: string;
  readonly valueContent?: Html | string;
  readonly icon?: Html;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly error?: string;
  readonly variant?: 'bordered' | 'borderless';
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly name?: string;
  readonly form?: string;
  readonly placement?: Primitive.AnchorConfig['placement'];
  /** Content between the current value and chevron, such as a shortcut chip. */
  readonly triggerTrailing?: readonly Html[];
}
const primitive = Primitive.create<Item, string>();
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const selected = props.items.find((item) => item.value === props.value);
  return h.div(
    [
      h.Class('ff-select-field'),
      h.Attribute('data-select-lifetime', String(model.lifetime)),
      h.OnUnmount(Message.Unmounted({ lifetime: model.lifetime })),
    ],
    [
      h.submodel({
        slotId: 'behavior',
        model: model.listbox,
        view: primitive.view,
        toParentMessage: (message) => Message.Behavior({ message, lifetime: model.lifetime }),
        viewInputs: {
          items: props.items,
          itemToValue: (item) => item.value,
          maybeSelectedValue: Option.fromUndefinedOr(props.value),
          isItemDisabled: (item) => !!item.disabled,
          itemToSearchText: (item) => item.label,
          isDisabled: props.disabled,
          isReadOnly: props.readOnly,
          isInvalid: !!props.error,
          ariaLabel: props.label,
          anchor: {
            placement: props.placement ?? 'bottom-start',
            gap: 6,
            padding: 8,
            portal: true,
          },
          className: 'ff-select',
          attributes: childAttributes([
            h.DataAttribute('size', props.size ?? 'default'),
            h.DataAttribute('radius', props.radius ?? 'rounded'),
            h.DataAttribute('variant', props.variant ?? 'bordered'),
          ]),
          buttonClassName: 'ff-select-trigger',
          buttonAttributes: childAttributes([
            ...(props.disabled ? [h.Disabled(true)] : []),
            ...(!selected ? [h.DataAttribute('placeholder', '')] : []),
          ]),
          buttonContent: h.span(
            [h.Class('ff-select-trigger-content')],
            [
              props.icon
                ? h.span([h.Class('ff-select-icon'), h.AriaHidden(true)], [props.icon])
                : null,
              h.span(
                [h.Class('ff-select-value')],
                [props.valueContent ?? selected?.label ?? props.placeholder ?? 'Select…'],
              ),
              ...(props.triggerTrailing ?? []),
              h.svg(
                [
                  h.Class('ff-select-chevron'),
                  h.AriaHidden(true),
                  h.Attribute('viewBox', '0 0 24 24'),
                  h.Attribute('fill', 'none'),
                  h.Attribute('stroke', 'currentColor'),
                  h.Attribute('stroke-width', '2'),
                  h.Attribute('stroke-linecap', 'round'),
                  h.Attribute('stroke-linejoin', 'round'),
                ],
                [h.path([h.Attribute('d', 'm6 9 6 6 6-6')], [])],
              ),
            ],
          ),
          itemsClassName: 'ff-popup',
          itemsAttributes: childAttributes([
            h.AriaLabel(props.label),
            h.DataAttribute('size', props.size ?? 'default'),
            h.DataAttribute('radius', props.radius === 'sharp' ? 'sharp' : 'rounded'),
          ]),
          itemsScrollClassName: 'ff-popup-viewport ff-scroll-fade',
          itemsScrollAttributes: childAttributes([h.OnMount(Mounted())]),
          backdropClassName: 'ff-popup-backdrop ff-select-backdrop',
          backdropAttributes: childAttributes([
            h.AriaHidden(true),
            h.DataAttribute('slot', 'popup-shield'),
            h.DataAttribute('shield-for', `${model.listbox.id}-items`),
          ]),
          itemGroupKey: (item) => item.group ?? '',
          groupToHeading: (key) =>
            key ? { content: h.span([h.Class('ff-popup-heading')], [key]) } : undefined,
          separatorClassName: 'ff-popup-separator',
          itemToConfig: (item) => ({
            className: 'ff-popup-row',
            content: rowContent({ label: item.label, icon: item.icon, check: true }, h),
          }),
        },
      }),
      // The primitive's hidden fields do not inherit isDisabled. Own the
      // successful form control here so a disabled Select is not submitted.
      props.name
        ? h.input([
            h.Type('hidden'),
            h.Name(props.name),
            h.Value(props.value ?? ''),
            h.Disabled(!!props.disabled),
            ...(props.form ? [h.Attribute('form', props.form)] : []),
          ])
        : null,
      props.error ? h.span([h.Class('ff-select-error')], [props.error]) : null,
    ],
  );
});
