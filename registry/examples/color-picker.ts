import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as ColorPicker from './fluid/components/color-picker';
import { Subscription } from 'foldkit';

export const Model = Schema.Struct({
  panel: ColorPicker.Model,
  popover: ColorPicker.Popover.Model,
  color: Schema.String,
  accent: Schema.String,
  removed: Schema.Number,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Panel: { message: ColorPicker.Message },
  Popover: { message: ColorPicker.Popover.Message },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    panel: ColorPicker.init({ id: 'inline-color', value: '#6B97FF' }),
    popover: ColorPicker.Popover.init({ id: 'accent-color', value: '#EF4444' }),
    color: '#6B97FF',
    accent: '#EF4444',
    removed: 0,
    shown: true,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Panel': {
      const result = ColorPicker.update(model.panel, message.message, { value: model.color });
      return {
        model: {
          ...model,
          panel: result.model,
          color: result.outMessage?._tag === 'ValueChanged' ? result.outMessage.value : model.color,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Panel({ message })),
        ),
      };
    }
    case 'Popover': {
      const result = ColorPicker.Popover.update(model.popover, message.message, {
        value: model.accent,
      });
      return {
        model: {
          ...model,
          popover: result.model,
          accent:
            result.outMessage?._tag === 'ValueChanged' ? result.outMessage.value : model.accent,
          removed: model.removed + (result.outMessage?._tag === 'Removed' ? 1 : 0),
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Popover({ message })),
        ),
      };
    }
    case 'VisibilityToggled':
      return {
        model: {
          ...model,
          shown: !model.shown,
          panel: ColorPicker.init({
            id: 'inline-color',
            value: model.color,
            format: model.panel.format,
          }),
          popover: ColorPicker.Popover.init({
            id: 'accent-color',
            value: model.accent,
            format: model.popover.picker.format,
          }),
        },
      };
  }
}
export const subscriptions = Subscription.aggregate(
  ColorPicker.subscriptions<Model, Message>(
    'inline',
    (model) => (model.shown ? model.panel : undefined),
    (message) => Message.Panel({ message }),
  ),
  ColorPicker.subscriptions<Model, Message>(
    'accent',
    (model) => (model.shown && model.popover.popover.isOpen ? model.popover.picker : undefined),
    (message) => Message.Popover({ message: ColorPicker.Popover.Message.Picker({ message }) }),
  ),
);

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'ColorPicker example',
    body: h.main(
      [],
      [
        h.h1([], ['ColorPicker']),
        model.shown
          ? h.submodel({
              slotId: 'inline',
              model: model.panel,
              view: ColorPicker.view,
              toParentMessage: (message) => Message.Panel({ message }),
              viewInputs: {
                value: model.color,
                hideEyedropper: true,
                swatches: [
                  { color: '#22C55E', label: 'Green' },
                  { color: '#EF4444', label: 'Red' },
                ],
              },
            })
          : null,
        model.shown
          ? h.submodel({
              slotId: 'accent',
              model: model.popover,
              view: ColorPicker.Popover.view,
              toParentMessage: (message) => Message.Popover({ message }),
              viewInputs: {
                value: model.accent,
                triggerLabel: 'Accent',
                triggerShowRemove: true,
                hideEyedropper: true,
                swatches: [{ color: '#22C55E', label: 'Green' }],
              },
            })
          : null,
        h.p([], [`Color: ${model.color}`]),
        h.p([], [`Accent: ${model.accent}`]),
        h.p([], [`Remove requests: ${model.removed}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide colors' : 'Show colors'],
        ),
      ],
    ),
  };
}
