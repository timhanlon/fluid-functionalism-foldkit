import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Scroller from './fluid/components/message-scroller';
import * as Button from './fluid/components/button';

export const Model = Schema.Struct({
  scroller: Scroller.Model,
  rows: Schema.Number,
  reply: Schema.String,
  anchor: Schema.Boolean,
  shown: Schema.Boolean,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Scroller: { message: Scroller.Message },
  Added: {},
  Grew: {},
  Reset: {},
  Toggled: {},
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: {
    scroller: Scroller.init({ id: 'conversation' }),
    rows: 12,
    reply: '',
    anchor: false,
    shown: true,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Scroller': {
      const result = Scroller.update(model.scroller, message.message);
      return {
        model: { ...model, scroller: result.model },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (message) => Message.Scroller({ message })),
        ),
      };
    }
    case 'Added':
      return { model: { ...model, rows: model.rows + 1, anchor: true, reply: '' } };
    case 'Grew':
      return {
        model: { ...model, reply: model.reply + 'The reply grows while you read. '.repeat(16) },
      };
    case 'Reset':
      return { model: { ...model, rows: 12, anchor: false, reply: '' } };
    case 'Toggled':
      return { model: { ...model, shown: !model.shown } };
  }
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'MessageScroller example',
    body: h.main(
      [],
      [
        h.h1([], ['MessageScroller']),
        h.div(
          [h.Style({ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' })],
          [
            Button.view({ children: ['New turn'], onClick: Message.Added() }, h),
            Button.view({ children: ['Grow reply'], onClick: Message.Grew() }, h),
            Button.view({ children: ['Reset history'], onClick: Message.Reset() }, h),
            Button.view(
              {
                children: [model.shown ? 'Unmount transcript' : 'Mount transcript'],
                onClick: Message.Toggled(),
              },
              h,
            ),
          ],
        ),
        model.shown
          ? h.submodel({
              slotId: 'conversation',
              model: model.scroller,
              view: Scroller.view,
              toParentMessage: (message) => Message.Scroller({ message }),
              viewInputs: {
                className: 'h-64',
                viewportClassName: 'p-4',
                showButton: true,
                renderContent: () => [
                  Scroller.content(
                    {
                      className: 'gap-2',
                      busy: !!model.reply,
                      children: [
                        ...Array.from({ length: model.rows }, (_, i) =>
                          Scroller.item(
                            {
                              key: `row-${i}`,
                              anchor: model.anchor && i === model.rows - 1,
                              children: [
                                h.p(
                                  [h.Class('rounded-lg bg-muted p-3')],
                                  [
                                    i === model.rows - 1 && model.anchor
                                      ? 'A new user turn'
                                      : `History ${i + 1}: a message already in the conversation.`,
                                  ],
                                ),
                              ],
                            },
                            h,
                          ),
                        ),
                        ...(model.reply
                          ? [
                              Scroller.item(
                                { key: 'reply', children: [h.p([h.Class('p-3')], [model.reply])] },
                                h,
                              ),
                            ]
                          : []),
                      ],
                    },
                    h,
                  ),
                ],
              },
            })
          : h.p([], ['Transcript unmounted']),
        h.p([], [model.scroller.atEnd ? 'At latest' : 'Reading history']),
      ],
    ),
  };
}
