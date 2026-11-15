import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { Tooltip as Primitive } from '@foldkit/ui';
import * as Tooltip from './state';

/** Keyed ownership for a collection of independent Foldkit tooltips. */
export const Model = Schema.Struct({
  id: Schema.String,
  delayDuration: Schema.Number,
  tooltips: Schema.Record(Schema.String, Tooltip.Model),
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Tip: { key: Schema.String, message: Tooltip.Message },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  VisibilityChanged: { key: Schema.String, message: Primitive.OutMessage },
});
export type OutMessage = typeof OutMessage.Type;
export const init = (config: { readonly id: string; readonly delayDuration?: number }): Model => ({
  id: config.id,
  delayDuration: config.delayDuration ?? 200,
  tooltips: {},
});
export const tooltipModel = (model: Model, key: string): Tooltip.Model =>
  model.tooltips[key] ?? Tooltip.init({ id: `${model.id}-${key}`, showDelay: model.delayDuration });
export function update(
  model: Model,
  message: Message,
  options: { readonly delayDuration?: number } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  const current = tooltipModel(model, message.key);
  const result = Tooltip.update(
    {
      ...current,
      tooltip: Primitive.reflectShowDelay(
        current.tooltip,
        options.delayDuration ?? model.delayDuration,
      ),
    },
    message.message,
  );
  return {
    model: { ...model, tooltips: { ...model.tooltips, [message.key]: result.model } },
    commands: result.commands?.map((command) =>
      Command.mapMessage(command, (message_) =>
        Message.Tip({ key: message.key, message: message_ }),
      ),
    ),
    outMessage: result.outMessage
      ? OutMessage.VisibilityChanged({ key: message.key, message: result.outMessage })
      : undefined,
  };
}
