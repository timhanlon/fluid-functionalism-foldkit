import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as KeyCap from './fluid/components/key-cap';
export const Model = Schema.Struct({ inverted: Schema.Boolean });
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({ Toggled: {} });
export type Message = typeof Message.Type;
export const init = () => ({ model: { inverted: false } });
export function update(model: Model, _message: Message): Update.Return<Model, Message> {
  return { model: { inverted: !model.inverted } };
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  const tone = model.inverted ? 'inverted' : 'default';
  return {
    title: 'KeyCap example',
    body: h.main(
      [],
      [
        h.h1([], ['KeyCap']),
        h.div(
          [
            h.Class('flex flex-wrap gap-3 p-3'),
            h.Style({ background: model.inverted ? 'var(--foreground)' : 'var(--background)' }),
          ],
          [
            KeyCap.view(
              { children: ['Tab'], tone, attributes: [h.DataAttribute('sample', 'tab')] },
              h,
            ),
            KeyCap.keys({ keys: '⇧⌘O', tone, attributes: [h.DataAttribute('sample', 'mac')] }, h),
            KeyCap.keys(
              { keys: 'Ctrl+K', tone, attributes: [h.DataAttribute('sample', 'windows')] },
              h,
            ),
            KeyCap.keys(
              { keys: ['Page Up'], tone, attributes: [h.DataAttribute('sample', 'name')] },
              h,
            ),
            KeyCap.keys(
              { keys: 'Ctrl++', tone, attributes: [h.DataAttribute('sample', 'plus')] },
              h,
            ),
          ],
        ),
        h.button([h.Type('button'), h.OnClick(Message.Toggled())], ['Toggle inverted tone']),
      ],
    ),
  };
}
