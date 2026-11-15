import { Combobox as Primitive } from '@foldkit/ui';
import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { candidate } from './creation';
import { matches, type Filter } from './filter';
import { type ItemData } from './item';
export { matches, defaultFilter, type Filter } from './filter';
export const Model = Schema.Struct({
  combo: Primitive.Model,
  query: Schema.String,
  editing: Schema.Boolean,
  lifetime: Schema.Number,
  ownerId: Schema.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Behavior: { message: Primitive.Message, lifetime: Schema.optionalKey(Schema.Number) },
  Unmounted: { lifetime: Schema.Number },
  Cleared: { lifetime: Schema.optionalKey(Schema.Number) },
  FocusRequested: { lifetime: Schema.optionalKey(Schema.Number) },
  CreatedRequested: { query: Schema.String, lifetime: Schema.optionalKey(Schema.Number) },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Selected: { value: Schema.String },
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
  combo: Primitive.init({
    id: lifetime ? `${id}-instance-${lifetime}` : id,
    isAnimated: true,
    isModal: false,
    selectInputOnFocus: true,
  }),
  query: '',
  lifetime,
  ownerId: id,
  editing: false,
});
export function update<Item extends ItemData>(
  model: Model,
  message: Message,
  items: readonly Item[],
  options: {
    readonly creatable?: boolean;
    readonly value?: string;
    readonly filter?: Filter<Item>;
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
  if (message._tag === 'CreatedRequested') {
    if (
      !options.creatable ||
      !model.combo.isOpen ||
      candidate(items, model.query) !== message.query
    )
      return { model };
    const result = Primitive.create<string>().update(
      model.combo,
      Primitive.Message.Closed({ restingInputValue: message.query, isClearable: false }),
    );
    return {
      model: { ...model, combo: result.model, editing: false },
      outMessage: OutMessage.Created({ query: message.query }),
      commands: (result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) =>
          Message.Behavior({ message, lifetime: model.lifetime }),
        ),
      ),
    };
  }
  const event =
    message._tag === 'Cleared'
      ? Primitive.Message.UpdatedInputValue({ value: '' })
      : message.message;
  const result = Primitive.create<string>().update(model.combo, event);
  let query = event._tag === 'UpdatedInputValue' ? event.value : model.query;
  if (
    (!model.combo.isOpen && result.model.isOpen && event._tag !== 'UpdatedInputValue') ||
    (!result.model.isOpen && result.model.animation.transitionState === 'Idle')
  )
    query = '';
  const combo = result.model;
  const outMessage =
    message._tag === 'Cleared'
      ? OutMessage.Selected({ value: '' })
      : result.outMessage?._tag === 'Selected'
        ? OutMessage.Selected({ value: result.outMessage.value })
        : result.outMessage?._tag === 'ClearedSelection'
          ? OutMessage.Selected({ value: '' })
          : undefined;
  return {
    model: {
      ...model,
      combo,
      query,
      editing: event._tag === 'UpdatedInputValue' ? true : !combo.isOpen ? false : model.editing,
    },
    outMessage,
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
