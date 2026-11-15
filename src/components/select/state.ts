import { Listbox as Primitive } from '@foldkit/ui';
import { Schema, Effect } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
export const behavior = Primitive.create();
export const Model = Schema.Struct({
  listbox: Primitive.Model,
  ackVersion: Schema.Number,
  lifetime: Schema.Number,
  ownerId: Schema.String,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Behavior: { message: Primitive.Message, lifetime: Schema.optionalKey(Schema.Number) },
  Unmounted: { lifetime: Schema.Number },
  Acknowledged: { version: Schema.Number },
});
export type Message = typeof Message.Type;
export type OutMessage = Primitive.OutMessage;
export const init = (config: { readonly id: string; readonly lifetime?: number }): Model => ({
  listbox: Primitive.init({
    id: config.lifetime ? `${config.id}-instance-${config.lifetime}` : config.id,
    isAnimated: true,
    isModal: false,
  }),
  ackVersion: 0,
  lifetime: config.lifetime ?? 0,
  ownerId: config.id,
});
export const Acknowledge = Command.define('Select.AcknowledgeSelection', {
  args: { version: Schema.Number },
  messages: [Message.Acknowledged],
  execute: ({ version }) =>
    Effect.sleep('300 millis').pipe(Effect.as(Message.Acknowledged({ version }))),
});
export function update(
  model: Model,
  message: Message,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (
    'lifetime' in message &&
    message.lifetime !== undefined &&
    message.lifetime !== model.lifetime
  )
    return { model };
  if (message._tag === 'Unmounted') {
    const fresh = init({ id: model.ownerId, lifetime: model.lifetime + 1 });
    return {
      model: {
        ...fresh,
        lifetime: model.lifetime + 1,
        ackVersion: model.ackVersion + 1,
        listbox: {
          ...fresh.listbox,
          animation: {
            ...fresh.listbox.animation,
            transitionGeneration: model.listbox.animation.transitionGeneration + 1,
          },
        },
      },
    };
  }
  if (message._tag === 'Acknowledged') {
    if (message.version !== model.ackVersion || !model.listbox.isOpen) return { model };
    return update(model, Message.Behavior({ message: Primitive.Message.Closed() }));
  }
  if (message.message._tag === 'SelectedItem') {
    if (!model.listbox.isOpen) return { model };
    const version = model.ackVersion + 1;
    return {
      model: { ...model, ackVersion: version },
      outMessage: Primitive.OutMessage.Selected({ value: message.message.item }),
      commands: [Acknowledge({ version })],
    };
  }
  const result = behavior.update(model.listbox, message.message);
  const ackVersion = model.ackVersion + (result.model.isOpen !== model.listbox.isOpen ? 1 : 0);
  return {
    model:
      result.model === model.listbox && ackVersion === model.ackVersion
        ? model
        : { ...model, listbox: result.model, ackVersion },
    outMessage: result.outMessage,
    commands: [
      ...(result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) =>
          Message.Behavior({ message, lifetime: model.lifetime }),
        ),
      ),
    ],
  };
}
