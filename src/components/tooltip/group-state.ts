import { Effect, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { Tooltip as Primitive } from '@foldkit/ui';
import * as Tooltip from './state';
export const Side = Schema.Literals(['top', 'right', 'bottom', 'left']);
export type Side = typeof Side.Type;
/** Coordination only: each official Tooltip still owns hover/focus/Escape and its anchor. */
export const Model = Schema.Struct({
  id: Schema.String,
  delayDuration: Schema.Number,
  skipDelayDuration: Schema.Number,
  tooltips: Schema.Record(Schema.String, Tooltip.Model),
  warm: Schema.Boolean,
  warmVersion: Schema.Number,
  side: Schema.NullOr(Side),
  sideVersion: Schema.Number,
  lifetime: Schema.Number,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Tip: {
    key: Schema.String,
    message: Tooltip.Message,
    lifetime: Schema.optionalKey(Schema.Number),
  },
  Cooled: { version: Schema.Number, lifetime: Schema.Number },
  SideReset: { lifetime: Schema.Number },
  Unmounted: { lifetime: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  VisibilityChanged: { key: Schema.String, message: Primitive.OutMessage },
});
export type OutMessage = typeof OutMessage.Type;
export interface InitConfig {
  readonly id: string;
  readonly delayDuration?: number;
  readonly skipDelayDuration?: number;
}
export const init = (config: InitConfig): Model => ({
  id: config.id,
  delayDuration: config.delayDuration ?? 200,
  skipDelayDuration: config.skipDelayDuration ?? 300,
  tooltips: {},
  warm: false,
  warmVersion: 0,
  side: null,
  sideVersion: 0,
  lifetime: 0,
});
export const tooltipModel = (model: Model, key: string): Tooltip.Model =>
  model.tooltips[key] ?? Tooltip.init({ id: `${model.id}-${key}`, showDelay: model.delayDuration });
export const Cool = Command.define('TooltipGroup.Cool', {
  args: { version: Schema.Number, lifetime: Schema.Number, delay: Schema.Number },
  messages: [Message.Cooled],
  execute: ({ version, lifetime, delay }) =>
    Effect.sleep(delay).pipe(Effect.as(Message.Cooled({ version, lifetime }))),
});
export function update(
  model: Model,
  message: Message,
  options: { readonly delayDuration?: number; readonly skipDelayDuration?: number } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message.lifetime !== undefined && message.lifetime !== model.lifetime) return { model };
  if (message._tag === 'Unmounted')
    return {
      model: {
        ...init(model),
        lifetime: model.lifetime + 1,
        warmVersion: model.warmVersion + 1,
        sideVersion: model.sideVersion + 1,
      },
    };
  if (message._tag === 'SideReset')
    return {
      model:
        model.side === null ? model : { ...model, side: null, sideVersion: model.sideVersion + 1 },
    };
  if (message._tag === 'Cooled')
    return { model: message.version === model.warmVersion ? { ...model, warm: false } : model };
  if (message.message._tag === 'GroupSidePlaced')
    return {
      model:
        message.message.sideVersion === model.sideVersion
          ? { ...model, side: message.message.side }
          : model,
    };
  const current = tooltipModel(model, message.key);
  const result = Tooltip.update(
    {
      ...current,
      tooltip: Primitive.reflectShowDelay(
        current.tooltip,
        model.warm ? 0 : (options.delayDuration ?? model.delayDuration),
      ),
    },
    message.message,
    { grouped: true },
  );
  const tooltips = { ...model.tooltips, [message.key]: result.model };
  const visible = Object.values(tooltips).some((tip) => tip.forceOpen ?? tip.tooltip.isOpen);
  const changed =
    (current.forceOpen ?? current.tooltip.isOpen) !==
    (result.model.forceOpen ?? result.model.tooltip.isOpen);
  const warmVersion = model.warmVersion + (changed ? 1 : 0);
  return {
    model: { ...model, tooltips, warmVersion, warm: visible || model.warm },
    commands: [
      ...(result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message_) =>
          Message.Tip({ key: message.key, message: message_, lifetime: model.lifetime }),
        ),
      ),
      ...(changed && !visible
        ? [
            Cool({
              version: warmVersion,
              lifetime: model.lifetime,
              delay: options.skipDelayDuration ?? model.skipDelayDuration,
            }),
          ]
        : []),
    ],
    outMessage: result.outMessage
      ? OutMessage.VisibilityChanged({ key: message.key, message: result.outMessage })
      : undefined,
  };
}
