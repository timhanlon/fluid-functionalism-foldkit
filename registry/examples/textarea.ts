import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Textarea from './fluid/components/textarea';

export const Model = Schema.Struct({ notes: Schema.String });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ NotesChanged: { value: Schema.String } });
export type Message = typeof Message.Type;
export const init = () => ({ model: { notes: '' } });

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'NotesChanged':
      return { model: { ...model, notes: message.value } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Textarea example',
    body: h.main(
      [],
      [
        h.h1([], ['Textarea']),
        h.label([h.For('example-notes')], ['Notes']),
        Textarea.view(
          {
            id: 'example-notes',
            value: model.notes,
            onInput: (value) => Message.NotesChanged({ value }),
            placeholder: 'Add a note',
            maxLength: 40,
            describedBy: 'notes-help',
          },
          h,
        ),
        h.p([h.Id('notes-help')], [`Characters: ${model.notes.length}/40`]),
        h.pre(
          [h.Style({ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' })],
          [`Saved notes: ${model.notes}`],
        ),
        Textarea.view(
          { id: 'example-summary', ariaLabel: 'Summary', value: 'Review only', readOnly: true },
          h,
        ),
        Textarea.view(
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
