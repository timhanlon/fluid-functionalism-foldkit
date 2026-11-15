import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Badge from './fluid/components/badge';

export const Model = Schema.Struct({ published: Schema.Boolean });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ Toggled: {} });
export type Message = typeof Message.Type;
export const init = () => ({ model: { published: false } });

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Toggled':
      return { model: { published: !model.published } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Badge example',
    body: h.main(
      [],
      [
        h.h1([], ['Badge']),
        Badge.view(
          {
            children: [model.published ? 'Published' : 'Queued'],
            color: model.published ? 'green' : 'amber',
            variant: model.published ? 'solid' : 'dot',
            radius: 'pill',
            attributes: [h.Role('status'), h.AriaLabel('Publication status')],
          },
          h,
        ),
        Badge.view({ children: ['Preview'], color: 'violet', size: 'compact', radius: 'sharp' }, h),
        h.p(
          [],
          [h.button([h.Type('button'), h.OnClick(Message.Toggled())], ['Toggle publication'])],
        ),
      ],
    ),
  };
}
