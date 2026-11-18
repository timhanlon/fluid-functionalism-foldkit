import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Confirmation from './fluid/components/confirmation';
import * as Button from './fluid/components/button';
import * as Banner from './fluid/components/banner';
export const Model = Schema.Struct({
  banner: Confirmation.Model,
  state: Schema.Literals(['requested', 'approved', 'denied']),
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Confirmation: { message: Confirmation.Message },
  Reset: {},
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: { banner: Confirmation.init({ id: 'build-approval' }), state: 'requested' as const },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  const result = Confirmation.update(
    model.banner,
    message._tag === 'Reset'
      ? Confirmation.Message.Banner({ message: Banner.Message.Showed() })
      : message.message,
  );
  return {
    model: {
      banner: result.model,
      state:
        message._tag === 'Reset'
          ? 'requested'
          : result.outMessage?._tag === 'Approved'
            ? 'approved'
            : result.outMessage?._tag === 'Denied'
              ? 'denied'
              : model.state,
    },
    commands: result.commands?.map((command) =>
      Command.mapMessage(command, (message) => Message.Confirmation({ message })),
    ),
  };
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Confirmation example',
    body: h.main(
      [],
      [
        h.h1([], ['Confirmation']),
        h.submodel({
          slotId: 'question',
          model: model.banner,
          view: Confirmation.view,
          toParentMessage: (message) => Message.Confirmation({ message }),
          viewInputs: {
            title: 'Run pnpm build?',
            description: 'Builds the app. Takes about a minute.',
            state: model.state,
            radius: 'sharp',
            dismissible: true,
            dismissLabel: 'Close question',
          },
        }),
        Button.view(
          {
            children: ['Ask again'],
            variant: 'ghost',
            size: 'compact',
            radius: 'sharp',
            className: model.state === 'requested' && model.banner.isShowing ? 'invisible' : '',
            onClick: Message.Reset(),
          },
          h,
        ),
      ],
    ),
  };
}
