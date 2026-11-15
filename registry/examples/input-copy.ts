import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as InputCopy from './fluid/components/input-copy';

const invitation = 'https://example.com/invite';
export const Model = Schema.Struct({
  copy: InputCopy.Model,
  copies: Schema.Number,
  disabled: Schema.Boolean,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Copy: { message: InputCopy.Message },
  DisabledToggled: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: { copy: InputCopy.init({ id: 'invitation' }), copies: 0, disabled: false, shown: true },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Copy': {
      const result = InputCopy.update(model.copy, message.message, invitation, {
        disabled: model.disabled,
      });
      return {
        model: {
          ...model,
          copy: result.model,
          copies: model.copies + (result.outMessage?._tag === 'Copied' ? 1 : 0),
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Copy({ message })),
        ),
      };
    }
    case 'DisabledToggled':
      return { model: { ...model, disabled: !model.disabled } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'InputCopy example',
    body: h.main(
      [],
      [
        h.h1([], ['InputCopy']),
        model.shown
          ? h.submodel({
              slotId: 'invitation',
              model: model.copy,
              view: InputCopy.view,
              toParentMessage: (message) => Message.Copy({ message }),
              viewInputs: {
                value: invitation,
                label: 'Invitation',
                disabled: model.disabled,
                variant: 'icon',
              },
            })
          : null,
        h.p([h.Attribute('aria-live', 'polite')], [`Successful copies: ${model.copies}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.DisabledToggled())],
          [model.disabled ? 'Enable copy' : 'Disable copy'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide copy' : 'Show copy'],
        ),
      ],
    ),
  };
}
