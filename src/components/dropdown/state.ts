import { Menu as Primitive } from '@foldkit/ui';
import { Option, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { Selection } from './panel';

const behavior = Primitive.create();
export const Model = Schema.Struct({
  ...Primitive.Model.fields,
  ownerId: Schema.String,
  lifetime: Schema.Number,
});
export type Model = typeof Model.Type;
const Lifecycle = defineMessageUnion({
  Scoped: { lifetime: Schema.Number, message: Primitive.Message },
  Unmounted: { lifetime: Schema.Number },
});
const constructors = Object.fromEntries(
  Object.entries(Primitive.Message).filter(
    ([, value]) => typeof value === 'function' && Reflect.has(value, 'fields'),
  ),
) as Pick<typeof Primitive.Message, Primitive.Message['_tag']>;
export const Message = Object.assign(
  Schema.Union([Primitive.Message, Lifecycle]).pipe(Schema.toTaggedUnion('_tag')),
  constructors,
  { Scoped: Lifecycle.Scoped, Unmounted: Lifecycle.Unmounted },
);
export type Message = typeof Message.Type;
export const primitiveMessage = (message: Message): Primitive.Message | undefined =>
  message._tag === 'Unmounted' ? undefined : message._tag === 'Scoped' ? message.message : message;
export type OutMessage = Primitive.OutMessage;
export const init = (config: { readonly id: string; readonly lifetime?: number }): Model => ({
  ...Primitive.init({
    id: config.lifetime ? `${config.id}-instance-${config.lifetime}` : config.id,
    isAnimated: true,
    isModal: false,
  }),
  ownerId: config.id,
  lifetime: config.lifetime ?? 0,
});
/** Retained component models must reject work belonging to a removed owner. */
export const accepts = (model: Model, message: Message): boolean =>
  !('lifetime' in message) || message.lifetime === model.lifetime;
export function update(
  model: Model,
  message: Message,
  options: { readonly selection?: Selection['mode'] } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (!accepts(model, message)) return { model };
  if (message._tag === 'Unmounted')
    return { model: init({ id: model.ownerId, lifetime: model.lifetime + 1 }) };
  const input = primitiveMessage(message)!;
  // A multi-selection menu keeps its parent-owned selection editable.
  if (input._tag === 'SelectedItem' && options.selection === 'multiple')
    return {
      model,
      outMessage: Primitive.OutMessage.Selected({ value: input.item, index: input.index }),
    };
  const result = behavior.update(model, input);
  // A multi-select stays open after selection. Consume the opening mouse gesture
  // so a later row click cannot also replay the primitive's press-drag select.
  const next =
    options.selection === 'multiple' &&
    (input._tag === 'ClickedButton' || input._tag === 'ReleasedPointerOnItems') &&
    Option.isSome(result.model.maybePointerOrigin)
      ? { ...result.model, maybePointerOrigin: Option.none() }
      : result.model;
  return {
    ...result,
    model: next === model ? model : { ...next, ownerId: model.ownerId, lifetime: model.lifetime },
    commands: result.commands?.map((command) =>
      Command.mapMessage(command, (message) =>
        Message.Scoped({ message, lifetime: model.lifetime }),
      ),
    ),
  };
}
