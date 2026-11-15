import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Combobox from './fluid/components/combobox';

const items = [
  { value: 'foldkit', label: 'Foldkit' },
  { value: 'elm', label: 'Elm' },
  { value: 'svelte', label: 'Svelte' },
];
export const Model = Schema.Struct({
  combo: Combobox.Model,
  value: Schema.String,
  multi: Combobox.Multi.Model,
  values: Schema.Array(Schema.String),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Combo: { message: Combobox.Message },
  Multi: { message: Combobox.Multi.Message },
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: {
    combo: Combobox.init({ id: 'example-framework' }),
    value: 'foldkit',
    multi: Combobox.Multi.init({ id: 'example-tags' }),
    values: ['foldkit'],
  },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Combo': {
      const result = Combobox.update(model.combo, message.message, items, { value: model.value });
      return {
        model: {
          ...model,
          combo: result.model,
          value: result.outMessage?._tag === 'Selected' ? result.outMessage.value : model.value,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Combo({ message })),
        ),
      };
    }
    case 'Multi': {
      const result = Combobox.Multi.update(model.multi, message.message, items, model.values);
      return {
        model: {
          ...model,
          multi: result.model,
          values: result.outMessage?._tag === 'Changed' ? result.outMessage.values : model.values,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Multi({ message })),
        ),
      };
    }
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Combobox example',
    body: h.main(
      [],
      [
        h.h1([], ['Combobox']),
        h.submodel({
          slotId: 'framework',
          model: model.combo,
          view: Combobox.view,
          toParentMessage: (message) => Message.Combo({ message }),
          viewInputs: { label: 'Framework', items, value: model.value },
        }),
        h.p([h.Attribute('aria-live', 'polite')], [`Selected framework: ${model.value}`]),
        h.submodel({
          slotId: 'tags',
          model: model.multi,
          view: Combobox.Multi.view,
          toParentMessage: (message) => Message.Multi({ message }),
          viewInputs: { label: 'Tags', items, values: model.values },
        }),
        h.p([h.Attribute('aria-live', 'polite')], [`Selected tags: ${model.values.join(',')}`]),
      ],
    ),
  };
}
