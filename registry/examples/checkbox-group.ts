import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as CheckboxGroup from './fluid/components/checkbox-group';
import * as Checkbox from './fluid/components/checkbox';
const options = [
  { value: 'mail', label: 'Email', disabled: false },
  { value: 'push', label: 'Push', disabled: false },
  { value: 'sms', label: 'SMS', disabled: true },
];

export const Model = Schema.Struct({ values: Schema.Array(Schema.String), shown: Schema.Boolean });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Changed: { value: Schema.String, checked: Schema.Boolean },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({ model: { values: ['mail'], shown: true } });
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Changed':
      return {
        model: {
          ...model,
          values: message.checked
            ? [...new Set([...model.values, message.value])]
            : model.values.filter((value) => value !== message.value),
        },
      };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'CheckboxGroup example',
    body: h.main(
      [],
      [
        h.h1([], ['CheckboxGroup']),
        model.shown
          ? CheckboxGroup.view(
              {
                label: 'Notifications',
                children: options.map((item) =>
                  Checkbox.view(
                    {
                      id: `notification-${item.value}`,
                      label: item.label,
                      checked: model.values.includes(item.value),
                      disabled: item.disabled,
                      name: 'notifications',
                      value: item.value,
                      onToggle: (checked) => Message.Changed({ value: item.value, checked }),
                    },
                    h,
                  ),
                ),
              },
              h,
            )
          : null,
        h.p([], [`Selected: ${model.values.join(',') || 'none'}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide checkboxes' : 'Show checkboxes'],
        ),
      ],
    ),
  };
}
