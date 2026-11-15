import { Combobox as Primitive } from '@foldkit/ui';
import { Option } from 'effect';
import { Submodel } from 'foldkit';
import { Model, Message, matches } from './state';
import { fieldInputs, type CommonProps, type ItemData } from './field';
import { creation, creationItem } from './creation';
import './styles.css';
import { itemValue, itemLabel } from './item';
export {
  Model,
  Message,
  OutMessage,
  init,
  update,
  matches,
  defaultFilter,
  type Filter,
} from './state';
export * as Multi from './multi';
export type { Item, ItemData } from './field';
export interface Props<Data extends ItemData = ItemData> extends CommonProps<Data> {
  readonly value?: string;
}
const behavior = Primitive.create<string>();
/** Bind consumer item metadata once, keeping the view's filter typed like update's. */
export const create = <Data extends ItemData = ItemData>() => ({
  view: Submodel.defineView<Model, Message, Props<Data>>((model, props, h) => {
    const selected = props.items.find((item) => itemValue(item) === props.value);
    const display = model.editing
      ? model.combo.inputValue
      : selected === undefined
        ? ''
        : itemLabel(selected);
    // The primitive owns the input Value. Appending another Value attribute makes
    // Foldkit replay both after a patch, resetting the native text selection.
    const combo =
      model.combo.inputValue === display ? model.combo : { ...model.combo, inputValue: display };
    const create = creation(props.items, model.query, props.creatable);
    const rows = [
      ...matches(
        props.items,
        model.query,
        props.filter,
        selected === undefined ? undefined : itemLabel(selected),
      ),
      ...(create ? [creationItem(create, props, h)] : []),
    ];
    return h.div(
      [
        h.Key(`single:${model.combo.id}`),
        h.Class('ff-combobox-field'),
        h.Attribute('data-combobox-lifetime', String(model.lifetime)),
        h.OnUnmount(Message.Unmounted({ lifetime: model.lifetime })),
      ],
      [
        h.submodel({
          slotId: 'behavior',
          model: combo,
          view: behavior.view,
          toParentMessage: (message) =>
            message._tag === 'SelectedItem' && create && message.item === create.value
              ? Message.CreatedRequested({ query: create.query, lifetime: model.lifetime })
              : Message.Behavior({ message, lifetime: model.lifetime }),
          viewInputs: {
            ...fieldInputs(
              {
                combo,
                display,
                resting: selected === undefined ? '' : itemLabel(selected),
                hasSelection: !!props.value,
              },
              props,
              rows,
              h,
              {
                behavior: (message) => Message.Behavior({ message, lifetime: model.lifetime }),
                clear: Message.Cleared({ lifetime: model.lifetime }),
                focus: Message.FocusRequested({ lifetime: model.lifetime }),
              },
            ),
            maybeSelectedValue: Option.fromUndefinedOr(props.value),
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
