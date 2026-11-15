import { Schema, Option } from 'effect';
import { Command, Subscription, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { Slider as Primitive } from '@foldkit/ui';
import * as Scalar from './state';
import { nearestIndex } from './values';
export type Value = readonly [number, number];
export const Model = Schema.Struct({ low: Scalar.Model, high: Scalar.Model, width: Schema.Number });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Low: { message: Scalar.Message },
  High: { message: Scalar.Message },
  PressedPointer: { index: Schema.Number, fraction: Schema.Number, width: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  ChangedValue: { value: Schema.Tuple([Schema.Number, Schema.Number]) },
});
export type OutMessage = typeof OutMessage.Type;
export const init = (config: Scalar.InitConfig): Model => ({
  low: Scalar.init({ ...config, id: `${config.id}-low` }),
  high: Scalar.init({ ...config, id: `${config.id}-high` }),
  width: 0,
});

/** Pointer travel retains Fluid's half-thumb gap before the final step snap. */
export function constrainPointer(
  model: Model,
  index: 0 | 1,
  value: number,
  current: Value,
): number {
  const limits = Scalar.range(model.low),
    usable = Math.max(1, model.width - 20);
  const gap = ((limits.max - limits.min) * 10) / usable;
  const constrained =
    index === 0 ? Math.min(value, current[1] - gap) : Math.max(value, current[0] + gap);
  return model.low.steps.length
    ? model.low.steps[nearestIndex(constrained, model.low.steps)]!
    : Primitive.snapAndClamp(constrained, limits.min, limits.max, limits.step);
}
export function update(
  model: Model,
  message: Message,
  current: Value,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message._tag === 'PressedPointer') {
    const index = message.index === 1 ? 1 : 0,
      child = index === 0 ? model.low : model.high;
    const slider = child.slider;
    const origin = child.steps.length ? nearestIndex(current[index], child.steps) : current[index];
    const value = slider.min + message.fraction * (slider.max - slider.min);
    return update(
      { ...model, width: message.width },
      index === 0
        ? Message.Low({
            message: Scalar.Message.PrimitiveMessage({
              message: Primitive.Message.PressedPointer({ value, originValue: origin }),
            }),
          })
        : Message.High({
            message: Scalar.Message.PrimitiveMessage({
              message: Primitive.Message.PressedPointer({ value, originValue: origin }),
            }),
          }),
      current,
    );
  }
  const index = message._tag === 'Low' ? 0 : 1,
    child = index === 0 ? model.low : model.high;
  const result = Scalar.update(child, message.message);
  let next = { ...model, [index === 0 ? 'low' : 'high']: result.model };
  if (message.message._tag === 'StartedEditing')
    next = {
      ...next,
      [index === 0 ? 'high' : 'low']: {
        ...(index === 0 ? model.high : model.low),
        editing: false,
        draft: '',
      },
    };
  let outMessage: OutMessage | undefined;
  if (result.outMessage) {
    let value = result.outMessage.value;
    const inner = message.message._tag === 'PrimitiveMessage' ? message.message.message : undefined;
    if (inner?._tag === 'PressedPointer' || inner?._tag === 'MovedDragPointer')
      value = constrainPointer(next, index, value, current);
    else if (inner?._tag === 'PressedKeyboardNavigation')
      value = index === 0 ? Math.min(value, current[1]) : Math.max(value, current[0]);
    outMessage = OutMessage.ChangedValue({
      value: index === 0 ? [value, current[1]] : [current[0], value],
    });
  }
  return {
    model: next,
    outMessage,
    commands: (result.commands ?? []).map((command) =>
      Command.mapMessage(command, (message) =>
        index === 0 ? Message.Low({ message }) : Message.High({ message }),
      ),
    ),
  };
}
export const subscriptions = Subscription.aggregate(
  Subscription.lift({
    lowPointer: Scalar.subscriptions.dragPointer,
    lowEscape: Scalar.subscriptions.dragEscape,
  })<Model, Message>({
    read: (model) => Option.some(model.low),
    toParentMessage: (message) => Message.Low({ message }),
  }),
  Subscription.lift({
    highPointer: Scalar.subscriptions.dragPointer,
    highEscape: Scalar.subscriptions.dragEscape,
  })<Model, Message>({
    read: (model) => Option.some(model.high),
    toParentMessage: (message) => Message.High({ message }),
  }),
);
