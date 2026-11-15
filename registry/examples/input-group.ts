import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as InputGroup from './fluid/components/input-group';
import * as InputField from './fluid/components/input-field';

export const Model = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  NameChanged: { value: Schema.String },
  EmailChanged: { value: Schema.String },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = () => ({ model: { name: '', email: '', shown: true } });

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'NameChanged':
      return { model: { ...model, name: message.value } };
    case 'EmailChanged':
      return { model: { ...model, email: message.value } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'InputGroup example',
    body: h.main(
      [],
      [
        h.h1([], ['InputGroup']),
        model.shown
          ? InputGroup.view(
              {
                size: 'compact',
                radius: 'sharp',
                children: [
                  InputField.view(
                    {
                      id: 'contact-name',
                      label: 'Name',
                      value: model.name,
                      onInput: (value) => Message.NameChanged({ value }),
                    },
                    h,
                  ),
                  InputField.view(
                    {
                      id: 'contact-email',
                      label: 'Email',
                      type: 'email',
                      value: model.email,
                      onInput: (value) => Message.EmailChanged({ value }),
                      error:
                        model.email && !model.email.includes('@')
                          ? 'Enter an email address.'
                          : undefined,
                    },
                    h,
                  ),
                  InputField.view(
                    { id: 'contact-plan', label: 'Plan', value: 'Personal', readOnly: true },
                    h,
                  ),
                  InputField.view(
                    {
                      id: 'contact-disabled',
                      label: 'Unavailable',
                      value: 'Unavailable',
                      disabled: true,
                    },
                    h,
                  ),
                ],
              },
              h,
            )
          : null,
        h.p([], [`Contact: ${model.name || 'none'}, ${model.email || 'none'}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide group' : 'Show group'],
        ),
      ],
    ),
  };
}
