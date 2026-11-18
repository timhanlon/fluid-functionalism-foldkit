import { Animation } from '@foldkit/ui';
import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';

export const Model = Schema.Struct({
  id: Schema.String,
  atEnd: Schema.Boolean,
  request: Schema.Number,
  lifetime: Schema.Number,
  button: Animation.Model,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  AtEndChanged: { atEnd: Schema.Boolean, lifetime: Schema.Number },
  ScrollToEndRequested: {},
  Animation: { message: Animation.Message, lifetime: Schema.Number },
  Unmounted: { lifetime: Schema.Number },
});
export type Message = typeof Message.Type;
export const init = ({ id }: { readonly id: string }): Model => ({
  id,
  atEnd: true,
  request: 0,
  lifetime: 0,
  button: Animation.init({ id: `${id}-button`, isShowing: false }),
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  if ('lifetime' in message && message.lifetime !== model.lifetime) return { model };
  if (message._tag === 'Unmounted')
    return {
      model: {
        ...model,
        atEnd: true,
        lifetime: model.lifetime + 1,
        button: Animation.init({ id: model.button.id, isShowing: false }),
      },
    };
  if (message._tag === 'ScrollToEndRequested')
    return { model: { ...model, request: model.request + 1 } };
  if (message._tag === 'AtEndChanged' && message.atEnd === model.atEnd) return { model };
  const event =
    message._tag === 'Animation'
      ? message.message
      : message.atEnd
        ? Animation.Message.Hid()
        : Animation.Message.Showed();
  const result = Animation.update(model.button, event);
  // The scoped Motion runtime, rather than a CSS settlement check, owns completion.
  const customSettlement =
    event._tag === 'CompletedWaitForPaint' && result.model.transitionState === 'EnterAnimating';
  return {
    model: {
      ...model,
      atEnd: message._tag === 'AtEndChanged' ? message.atEnd : model.atEnd,
      button: result.model,
    },
    commands: customSettlement
      ? []
      : result.commands?.map((command) =>
          Command.mapMessage(command, (message) =>
            Message.Animation({ message, lifetime: model.lifetime }),
          ),
        ),
  };
}
