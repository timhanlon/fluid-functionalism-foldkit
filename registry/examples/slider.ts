import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Slider from './fluid/components/slider';
import { Option } from 'effect';
import { Subscription } from 'foldkit';

export const Model = Schema.Struct({
  slider: Slider.Model,
  range: Slider.Range.Model,
  value: Schema.Number,
  rangeValue: Schema.Tuple([Schema.Number, Schema.Number]),
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Scalar: { message: Slider.Message },
  Range: { message: Slider.Range.Message },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    slider: Slider.init({ id: 'volume', min: 0, max: 100, step: 10 }),
    range: Slider.Range.init({ id: 'budget', min: 0, max: 100, step: 10 }),
    value: 50,
    rangeValue: [20, 80],
    shown: true,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Scalar': {
      const result = Slider.update(model.slider, message.message);
      return {
        model: { ...model, slider: result.model, value: result.outMessage?.value ?? model.value },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Scalar({ message })),
        ),
      };
    }
    case 'Range': {
      const result = Slider.Range.update(model.range, message.message, model.rangeValue);
      return {
        model: {
          ...model,
          range: result.model,
          rangeValue: result.outMessage?.value ?? model.rangeValue,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Range({ message })),
        ),
      };
    }
    case 'VisibilityToggled':
      return {
        model: {
          ...model,
          shown: !model.shown,
          slider: Slider.init({ id: 'volume', min: 0, max: 100, step: 10 }),
          range: Slider.Range.init({ id: 'budget', min: 0, max: 100, step: 10 }),
        },
      };
  }
}
export const subscriptions = Subscription.aggregate(
  Subscription.lift(Slider.subscriptions)<Model, Message>({
    read: (model) => (model.shown ? Option.some(model.slider) : Option.none()),
    toParentMessage: (message) => Message.Scalar({ message }),
  }),
  Subscription.lift(Slider.Range.subscriptions)<Model, Message>({
    read: (model) => (model.shown ? Option.some(model.range) : Option.none()),
    toParentMessage: (message) => Message.Range({ message }),
  }),
);

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Slider example',
    body: h.main(
      [],
      [
        h.h1([], ['Slider']),
        model.shown
          ? h.submodel({
              slotId: 'volume',
              model: model.slider,
              view: Slider.view,
              toParentMessage: (message) => Message.Scalar({ message }),
              viewInputs: { value: model.value, label: 'Volume', size: 'compact', showSteps: true },
            })
          : null,
        model.shown
          ? h.submodel({
              slotId: 'budget',
              model: model.range,
              view: Slider.Range.view,
              toParentMessage: (message) => Message.Range({ message }),
              viewInputs: { value: model.rangeValue, label: 'Budget' },
            })
          : null,
        h.p([], [`Volume: ${model.value}`]),
        h.p([], [`Budget: ${model.rangeValue.join('-')}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide sliders' : 'Show sliders'],
        ),
      ],
    ),
  };
}
