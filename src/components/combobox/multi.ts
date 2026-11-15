import { Combobox as Primitive, Button } from '@foldkit/ui';
import { Mount, Submodel } from 'foldkit';
import { childAttributes } from 'foldkit/html';
import { fieldInputs, type CommonProps, type ItemData } from './field';
import { Model, Message, visibleItems } from './multi-state';
import { icon } from '../icons';
import { Mounted } from './chips-runtime';
import { creation, creationItem } from './creation';
import './styles.css';
import { itemValue, itemLabel } from './item';
export { Model, Message, OutMessage, init, update, visibleItems } from './multi-state';
export interface Props<Data extends ItemData = ItemData> extends CommonProps<Data> {
  readonly values: readonly string[];
  readonly hideSelected?: boolean;
  readonly allSelectedLabel?: string;
}
const behavior = Primitive.Multi.create<string>();
export const create = <Data extends ItemData = ItemData>() => ({
  view: Submodel.defineView<Model, Message, Props<Data>>((model, props, h) => {
    const create = creation(props.items, model.query, props.creatable);
    const rows = [
      ...visibleItems(props.items, model.query, props.values, props.hideSelected, props.filter),
      ...(create ? [creationItem(create, props, h)] : []),
    ];
    const allSelected =
      props.hideSelected && !model.query.trim() && props.items.length > 0 && !rows.length;
    const inputs = fieldInputs(
      {
        combo: model.combo,
        display: model.combo.inputValue,
        resting: '',
        hasSelection: !!props.values.length,
        multiple: true,
      },
      {
        ...props,
        placeholder: props.values.length ? '' : props.placeholder,
        emptyLabel: allSelected ? (props.allSelectedLabel ?? props.emptyLabel) : props.emptyLabel,
      },
      rows,
      h,
      {
        behavior: (message) => Message.Behavior({ message, lifetime: model.lifetime }),
        clear: Message.Cleared({ lifetime: model.lifetime }),
        focus: Message.FocusRequested({ lifetime: model.lifetime }),
      },
    );
    return h.div(
      [
        h.Key(`multiple:${model.combo.id}`),
        h.Class('ff-combobox-field'),
        h.Attribute('data-combobox-lifetime', String(model.lifetime)),
        h.OnUnmount(Message.Unmounted({ lifetime: model.lifetime })),
      ],
      [
        h.submodel({
          slotId: 'behavior',
          model: model.combo,
          view: behavior.view,
          toParentMessage: (message) =>
            message._tag === 'SelectedItem' && create && message.item === create.value
              ? Message.CreatedRequested({ query: create.query, lifetime: model.lifetime })
              : Message.Behavior({ message, lifetime: model.lifetime }),
          viewInputs: {
            ...inputs,
            selectedValues: props.values,
            inputAttributes: [
              ...(inputs.inputAttributes ?? []),
              ...childAttributes([
                h.Attribute('size', String(Math.max(1, model.query.length + 1))),
              ]),
            ],
            renderInputContent: (input) =>
              h.div(
                [
                  h.Class('ff-combobox-chips'),
                  h.DataAttribute('has-selection', String(!!props.values.length)),
                  h.DataAttribute('has-icon', String(!!props.icon)),
                  h.OnMount(
                    Mount.mapMessage(Mounted(), (message) => ({
                      ...message,
                      lifetime: model.lifetime,
                    })),
                  ),
                ],
                [
                  ...props.values.map((value) => {
                    const label = itemLabel(
                      props.items.find((item) => itemValue(item) === value) ?? value,
                    );
                    return h.keyed('div')(
                      `chip:${value}`,
                      [
                        h.Class('ff-combobox-chip'),
                        h.Tabindex(-1),
                        h.AriaLabel(label),
                        h.DataAttribute('combobox-chip', ''),
                        h.DataAttribute('value', value),
                      ],
                      [
                        h.span([h.Class('ff-combobox-chip-label')], [label]),
                        Button.view(
                          {
                            isDisabled: props.disabled || props.readOnly,
                            onClick: Message.Removed({ value, lifetime: model.lifetime }),
                            toView: ({ button }) =>
                              h.button(
                                [
                                  ...button,
                                  h.Tabindex(-1),
                                  h.AriaLabel(`Remove ${label}`),
                                  h.Class('ff-combobox-chip-remove'),
                                  h.DataAttribute('chip-remove', ''),
                                ],
                                [
                                  icon('x', props.icons, h, {
                                    attributes: [h.Attribute('stroke-width', '2')],
                                  }),
                                ],
                              ),
                          },
                          h,
                        ),
                      ],
                    );
                  }),
                  h.keyed('span')('input', [h.Class('ff-combobox-chip-input')], [input]),
                ],
              ),
          },
        }),
        props.error
          ? h.span([h.Id(`${model.combo.id}-error`), h.Class('ff-combobox-error')], [props.error])
          : null,
      ],
    );
  }),
});
export const { view } = create();
