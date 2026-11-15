import { Slider as Primitive } from '@foldkit/ui';
import { Schema, Option, Effect } from 'effect';
import { Command, Subscription, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { nearestIndex, normalizedSteps, pointerIndex } from './values';

export const Model = Schema.Struct({
  slider: Primitive.Model,
  steps: Schema.Array(Schema.Number),
  editing: Schema.Boolean,
  draft: Schema.String,
  hover: Schema.NullOr(Schema.Number),
  lastHover: Schema.Number,
  hoverTooltip: Schema.Boolean,
  hoverVersion: Schema.Number,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  PrimitiveMessage: { message: Primitive.Message },
  StartedEditing: { value: Schema.Number },
  ChangedDraft: { value: Schema.String },
  CommittedEdit: {},
  CancelledEdit: {},
  HoveredValue: { value: Schema.Number },
  LeftHover: {},
  ShowHoverTooltip: { version: Schema.Number },
});
export type Message = typeof Message.Type;
export type OutMessage = Primitive.OutMessage;
export interface InitConfig {
  readonly id: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly steps?: readonly number[];
}
export const init = (config: InitConfig): Model => {
  const steps = normalizedSteps(config.steps);
  return {
    slider: Primitive.init({
      id: config.id,
      min: steps.length ? 0 : (config.min ?? 0),
      max: steps.length ? steps.length - 1 : (config.max ?? 100),
      step: steps.length ? 1 : (config.step ?? 1),
    }),
    steps,
    editing: false,
    draft: '',
    hover: null,
    lastHover: 0,
    hoverTooltip: false,
    hoverVersion: 0,
  };
};
export function range(model: Model) {
  return {
    min: model.steps[0] ?? model.slider.min,
    max: model.steps.at(-1) ?? model.slider.max,
    step: model.slider.step,
  };
}
const DelayHover = Command.define('Slider.DelayHover', {
  args: { version: Schema.Number },
  messages: [Message.ShowHoverTooltip],
  execute: ({ version }) =>
    Effect.sleep('100 millis').pipe(Effect.as(Message.ShowHoverTooltip({ version }))),
});
export function update(
  model: Model,
  message: Message,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  switch (message._tag) {
    case 'HoveredValue': {
      if (model.hover !== null)
        return {
          model:
            model.hover === message.value
              ? model
              : { ...model, hover: message.value, lastHover: message.value },
        };
      const version = model.hoverVersion + 1;
      return {
        model: { ...model, hover: message.value, lastHover: message.value, hoverVersion: version },
        commands: [DelayHover({ version })],
      };
    }
    case 'LeftHover':
      return {
        model: { ...model, hover: null, hoverTooltip: false, hoverVersion: model.hoverVersion + 1 },
      };
    case 'ShowHoverTooltip':
      return {
        model:
          model.hover !== null && model.hoverVersion === message.version
            ? { ...model, hoverTooltip: true }
            : model,
      };
    case 'StartedEditing':
      return {
        model: model.editing ? model : { ...model, editing: true, draft: String(message.value) },
      };
    case 'ChangedDraft':
      return { model: model.editing ? { ...model, draft: message.value } : model };
    case 'CancelledEdit':
      return { model: { ...model, editing: false, draft: '' } };
    case 'CommittedEdit': {
      if (!model.editing) return { model };
      const parsed = Number.parseFloat(model.draft);
      return {
        model: { ...model, editing: false, draft: '' },
        ...(Number.isNaN(parsed)
          ? {}
          : {
              outMessage: Primitive.OutMessage.ChangedValue({
                value: model.steps.length
                  ? model.steps[nearestIndex(parsed, model.steps)]!
                  : Primitive.snapAndClamp(
                      parsed,
                      model.slider.min,
                      model.slider.max,
                      model.slider.step,
                    ),
              }),
            }),
      };
    }
    case 'PrimitiveMessage': {
      let child = message.message;
      if (
        model.steps.length &&
        (child._tag === 'PressedPointer' || child._tag === 'MovedDragPointer')
      )
        child = { ...child, value: pointerIndex(child.value, model.steps) };
      const result = Primitive.update(model.slider, child);
      return {
        model: { ...model, slider: result.model },
        outMessage:
          result.outMessage && model.steps.length
            ? Primitive.OutMessage.ChangedValue({ value: model.steps[result.outMessage.value]! })
            : result.outMessage,
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.PrimitiveMessage({ message })),
        ),
      };
    }
  }
}
export const subscriptions = Subscription.lift(Primitive.subscriptions)<Model, Message>({
  read: (model) => Option.some(model.slider),
  toParentMessage: (message) => Message.PrimitiveMessage({ message }),
});
