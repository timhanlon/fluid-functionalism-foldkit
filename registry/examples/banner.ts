import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Banner from './fluid/components/banner';
import { Command } from 'foldkit';

export const Model = Schema.Struct({
  banner: Banner.Model,
  dismissed: Schema.Number,
  hidden: Schema.Number,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ Banner: { message: Banner.Message } });
export type Message = typeof Message.Type;
export const init = () => ({
  model: { banner: Banner.init({ id: 'registry-notice', open: true }), dismissed: 0, hidden: 0 },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Banner': {
      const result = Banner.update(model.banner, message.message);
      return {
        model: {
          ...model,
          banner: result.model,
          dismissed: model.dismissed + (result.outMessage?._tag === 'Dismissed' ? 1 : 0),
          hidden: model.hidden + (result.outMessage?._tag === 'Hidden' ? 1 : 0),
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Banner({ message })),
        ),
      };
    }
  }
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Banner example',
    body: h.main(
      [],
      [
        h.h1([], ['Banner']),
        h.submodel({
          slotId: 'notice',
          model: model.banner,
          view: Banner.view,
          toParentMessage: (message) => Message.Banner({ message }),
          viewInputs: {
            title: 'Workspace saved',
            description: 'Your changes are available to the team.',
            status: 'success',
            dismissible: true,
            dismissLabel: 'Dismiss notice',
          },
        }),
        h.button(
          [h.Type('button'), h.OnClick(Message.Banner({ message: Banner.Message.Showed() }))],
          ['Show notice'],
        ),
        h.p([], [`Dismissals: ${model.dismissed}; hidden: ${model.hidden}`]),
      ],
    ),
  };
}
