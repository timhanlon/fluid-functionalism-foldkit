import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Card from './fluid/components/card';

export const Model = Schema.Struct({
  selected: Schema.String,
  dismissed: Schema.Boolean,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Selected: { value: Schema.String },
  Dismissed: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = () => ({ model: { selected: 'alpha', dismissed: false, shown: true } });
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Selected':
      return { model: { ...model, selected: message.value } };
    case 'Dismissed':
      return { model: { ...model, dismissed: true, selected: 'alpha' } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Card example',
    body: h.main(
      [],
      [
        h.h1([], ['Card']),
        model.shown
          ? Card.group(
              {
                columns: 1,
                border: 'outlined',
                separated: true,
                cards: ['alpha', ...(model.dismissed ? [] : ['beta'])].map((value) => ({
                  key: value,
                  label: `Select ${value}`,
                  selected: model.selected === value,
                  onClick: Message.Selected({ value }),
                  dismissible: value === 'beta',
                  dismissOnHover: false,
                  onDismiss: Message.Dismissed(),
                  children: [
                    Card.header({ children: [Card.title({ children: [value] }, h)] }, h),
                    Card.content(
                      { children: [Card.description({ children: ['Choose a workspace.'] }, h)] },
                      h,
                    ),
                  ],
                })),
              },
              h,
            )
          : null,
        h.p([], [`Selected: ${model.selected}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide cards' : 'Show cards'],
        ),
      ],
    ),
  };
}
