import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Checkbox from './fluid/components/checkbox';

export const Model = Schema.Struct({ checked: Schema.Boolean });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ Toggled: { checked: Schema.Boolean } });
export type Message = typeof Message.Type;
export const init = () => ({ model: { checked: false } });

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Toggled':
      return { model: { ...model, checked: message.checked } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Checkbox example',
    body: h.main(
      [],
      [
        h.h1([], ['Checkbox']),
        Checkbox.view(
          {
            id: 'example-updates',
            label: 'Send updates',
            checked: model.checked,
            onToggle: (checked) => Message.Toggled({ checked }),
          },
          h,
        ),
        h.p([h.Attribute('aria-live', 'polite')], [`Updates enabled: ${model.checked}`]),
      ],
    ),
  };
}
