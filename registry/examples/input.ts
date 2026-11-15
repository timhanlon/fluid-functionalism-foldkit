import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Input from './fluid/components/input';

export const Model = Schema.Struct({
  email: Schema.String,
  seats: Schema.String,
  files: Schema.Array(Schema.String),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  EmailChanged: { value: Schema.String },
  SeatsChanged: { value: Schema.String },
  FilesSelected: { names: Schema.Array(Schema.String) },
});
export type Message = typeof Message.Type;
export const init = () => ({ model: { email: '', seats: '2', files: [] } });

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'EmailChanged':
      return { model: { ...model, email: message.value } };
    case 'SeatsChanged':
      return { model: { ...model, seats: message.value } };
    case 'FilesSelected':
      return { model: { ...model, files: message.names } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Input example',
    body: h.main(
      [],
      [
        h.h1([], ['Input']),
        h.label([h.For('example-email')], ['Email']),
        Input.view(
          {
            id: 'example-email',
            type: 'email',
            value: model.email,
            onInput: (value) => Message.EmailChanged({ value }),
            required: true,
          },
          h,
        ),
        h.p([], [`Email value: ${model.email}`]),
        h.label([h.For('example-seats')], ['Seats']),
        Input.view(
          {
            id: 'example-seats',
            type: 'number',
            value: model.seats,
            min: 1,
            max: 3,
            step: 0.5,
            onInput: (value) => Message.SeatsChanged({ value }),
          },
          h,
        ),
        h.p([], [`Seats value: ${model.seats}`]),
        h.label([h.For('example-files')], ['Attachments']),
        Input.view(
          {
            id: 'example-files',
            type: 'file',
            multiple: true,
            accept: '.txt',
            onFiles: (files) => Message.FilesSelected({ names: files.map((file) => file.name) }),
          },
          h,
        ),
        h.p([], [`Selected files: ${model.files.join(', ') || 'none'}`]),
        Input.view(
          { id: 'example-account', ariaLabel: 'Account', value: 'Personal', readOnly: true },
          h,
        ),
        Input.view(
          {
            id: 'example-disabled',
            ariaLabel: 'Unavailable',
            value: 'Unavailable',
            disabled: true,
          },
          h,
        ),
      ],
    ),
  };
}
