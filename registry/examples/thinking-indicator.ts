import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as ThinkingIndicator from './fluid/components/thinking-indicator';

export const Model = Schema.Struct({ shown: Schema.Boolean, icon: Schema.Boolean });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ VisibilityToggled: {}, IconToggled: {} });
export type Message = typeof Message.Type;
export const init = () => ({ model: { shown: true, icon: true } });
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
    case 'IconToggled':
      return { model: { ...model, icon: !model.icon } };
  }
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'ThinkingIndicator example',
    body: h.main(
      [],
      [
        h.h1([], ['ThinkingIndicator']),
        model.shown ? ThinkingIndicator.view({ showIcon: model.icon, size: 'compact' }, h) : null,
        h.button(
          [h.Type('button'), h.OnClick(Message.IconToggled())],
          [model.icon ? 'Hide icon' : 'Show icon'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide indicator' : 'Show indicator'],
        ),
      ],
    ),
  };
}
