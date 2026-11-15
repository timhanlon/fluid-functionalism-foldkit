import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Button from './fluid/components/button';

export const Model = Schema.Struct({ count: Schema.Number });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ Clicked: {} });
export type Message = typeof Message.Type;
export const init = () => ({ model: { count: 0 } });

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Clicked':
      return { model: { count: model.count + 1 } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Button example',
    body: h.main(
      [],
      [
        h.h1([], ['Button']),
        Button.view({ children: [`Clicked ${model.count} times`], onClick: Message.Clicked() }, h),
      ],
    ),
  };
}
