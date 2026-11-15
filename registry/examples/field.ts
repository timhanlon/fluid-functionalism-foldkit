import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Field from './fluid/components/field';
import * as Input from './fluid/components/input';

export const Model = Schema.Struct({
  name: Schema.String,
  submitted: Schema.Boolean,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  NameChanged: { value: Schema.String },
  Submitted: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = () => ({ model: { name: '', submitted: false, shown: true } });

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'NameChanged':
      return { model: { ...model, name: message.value } };
    case 'Submitted':
      return { model: { ...model, submitted: true } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  const invalid = model.submitted && model.name.trim().length < 3;
  return {
    title: 'Field example',
    body: h.main(
      [],
      [
        h.h1([], ['Field']),
        h.p([h.Id('external-help')], ['Your public profile name.']),
        Field.set(
          {
            children: [
              Field.legend({ children: ['Profile'] }, h),
              Field.group(
                {
                  children: [
                    model.shown
                      ? Field.view(
                          {
                            invalid,
                            children: [
                              Field.label(
                                { htmlFor: 'profile-name', children: ['Display name'] },
                                h,
                              ),
                              Field.content(
                                {
                                  children: [
                                    Input.view(
                                      {
                                        id: 'profile-name',
                                        value: model.name,
                                        invalid,
                                        describedBy: 'external-help',
                                        onInput: (value) => Message.NameChanged({ value }),
                                      },
                                      h,
                                    ),
                                    Field.description(
                                      { id: 'name-help', children: ['Use at least 3 characters.'] },
                                      h,
                                    ),
                                    Field.error(
                                      {
                                        id: 'name-error',
                                        errors: invalid ? [{ message: 'Name is too short.' }] : [],
                                      },
                                      h,
                                    ),
                                  ],
                                },
                                h,
                              ),
                            ],
                          },
                          h,
                        )
                      : null,
                  ],
                },
                h,
              ),
            ],
          },
          h,
        ),
        h.button([h.Type('button'), h.OnClick(Message.Submitted())], ['Validate profile']),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide field' : 'Show field'],
        ),
        h.p([], [`Profile valid: ${model.submitted && !invalid}`]),
      ],
    ),
  };
}
