import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Accordion from './fluid/components/accordion';
const options: Accordion.Options = {
  type: 'multiple',
  defaultValue: ['shipping'],
  items: [
    { value: 'shipping', label: 'Shipping', content: 'Ships within two days.' },
    { value: 'returns', label: 'Returns', content: 'Return within thirty days.' },
    { value: 'locked', label: 'Unavailable', disabled: true },
  ],
};

export const Model = Schema.Struct({ control: Accordion.Model, shown: Schema.Boolean });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Control: { message: Accordion.Message },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: { control: Accordion.init(options), shown: true },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Control':
      return {
        model: { ...model, control: Accordion.update(model.control, message.message, options) },
      };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Accordion example',
    body: h.main(
      [],
      [
        h.h1([], ['Accordion']),
        model.shown
          ? h.submodel({
              slotId: 'questions',
              model: model.control,
              view: Accordion.view,
              toParentMessage: (message) => Message.Control({ message }),
              viewInputs: { ...options, id: 'questions' },
            })
          : null,
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide accordion' : 'Show accordion'],
        ),
      ],
    ),
  };
}
