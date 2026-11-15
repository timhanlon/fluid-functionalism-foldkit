import { Combobox as Primitive } from '@foldkit/ui';
import { Option, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { matches } from './state';
import { itemValue, type ItemData } from './item';
import { candidate } from './creation';
import type { Filter } from './filter';
export const Model = Schema.Struct({
  combo: Primitive.Multi.Model,
  query: Schema.String,
  lifetime: Schema.Number,
  ownerId: Schema.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Behavior: { message: Primitive.Message, lifetime: Schema.optionalKey(Schema.Number) },
  Unmounted: { lifetime: Schema.Number },
  Removed: { value: Schema.String, lifetime: Schema.optionalKey(Schema.Number) },
  Cleared: { lifetime: Schema.optionalKey(Schema.Number) },
  FocusRequested: { lifetime: Schema.optionalKey(Schema.Number) },
  CreatedRequested: { query: Schema.String, lifetime: Schema.optionalKey(Schema.Number) },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Changed: { values: Schema.Array(Schema.String) },
  Created: { query: Schema.String },
});
export type OutMessage = typeof OutMessage.Type;
export const init = ({
  id,
  lifetime = 0,
}: {
  readonly id: string;
  readonly lifetime?: number;
}): Model => ({
  combo: Primitive.Multi.init({
    id: lifetime ? `${id}-instance-${lifetime}` : id,
    isAnimated: true,
    isModal: false,
  }),
  query: '',
  lifetime,
  ownerId: id,
});
export function visibleItems<Data extends ItemData>(
  items: readonly Data[],
  query: string,
  values: readonly string[],
  hideSelected = false,
  filter?: Filter<Data>,
): readonly Data[] {
  return matches(items, query, filter).filter(
    (item) => !hideSelected || !values.includes(itemValue(item)),
  );
}
const behavior = Primitive.Multi.create<string>();
export function update<Data extends ItemData>(
  model: Model,
  message: Message,
  items: readonly Data[],
  values: readonly string[],
  options: {
    readonly hideSelected?: boolean;
    readonly creatable?: boolean;
    readonly filter?: Filter<Data>;
  } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message.lifetime !== undefined && message.lifetime !== model.lifetime) return { model };
  if (message._tag === 'Unmounted') {
    const fresh = init({ id: model.ownerId, lifetime: model.lifetime + 1 });
    return {
      model: {
        ...fresh,
        lifetime: model.lifetime + 1,
        combo: {
          ...fresh.combo,
          animation: {
            ...fresh.combo.animation,
            transitionGeneration: model.combo.animation.transitionGeneration + 1,
          },
        },
      },
    };
  }
  if (message._tag === 'FocusRequested')
    return {
      model,
      commands: [
        Command.mapMessage(Primitive.FocusInput({ id: model.combo.id }), (message) =>
          Message.Behavior({ message, lifetime: model.lifetime }),
        ),
      ],
    };
  if (message._tag === 'CreatedRequested')
    return options.creatable &&
      model.combo.isOpen &&
      candidate(items, model.query) === message.query
      ? { model, outMessage: OutMessage.Created({ query: message.query }) }
      : { model };
  if (message._tag === 'Removed')
    return values.includes(message.value)
      ? {
          model,
          outMessage: OutMessage.Changed({
            values: values.filter((value) => value !== message.value),
          }),
        }
      : { model };
  const event =
    message._tag === 'Cleared'
      ? Primitive.Message.UpdatedInputValue({ value: '' })
      : message.message;
  if (event._tag === 'SelectedItem' && !model.combo.isOpen) return { model };
  const result = behavior.update(model.combo, event);
  let nextValues = values;
  if (message._tag === 'Cleared') nextValues = [];
  else if (result.outMessage?._tag === 'Selected') {
    const value = result.outMessage.value;
    nextValues = values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  }
  const selected = result.outMessage?._tag === 'Selected';
  let query = event._tag === 'UpdatedInputValue' ? event.value : model.query;
  if (
    (!model.combo.isOpen && result.model.isOpen && event._tag !== 'UpdatedInputValue') ||
    (!result.model.isOpen && result.model.animation.transitionState === 'Idle')
  )
    query = '';
  // Hiding the selected row changes the projected dataset; discard its index
  // rather than choosing the next target on the primitive's behalf.
  const combo =
    selected && options.hideSelected
      ? { ...result.model, maybeActiveItemIndex: Option.none() }
      : result.model;
  return {
    model: { ...model, combo, query },
    outMessage: nextValues === values ? undefined : OutMessage.Changed({ values: nextValues }),
    commands: [
      ...(result.commands ?? []),
      ...(message._tag === 'Cleared' ? [Primitive.FocusInput({ id: combo.id })] : []),
    ].map((command) =>
      Command.mapMessage(command, (message) =>
        Message.Behavior({ message, lifetime: model.lifetime }),
      ),
    ),
  };
}
