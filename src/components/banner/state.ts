import { Animation } from '@foldkit/ui';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
export const Model = Animation.Model;
export type Model = Animation.Model;
export const Message = defineMessageUnion({
  Dismissed: {},
  Showed: {},
  Hid: {},
  Animation: { message: Animation.Message },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({ Dismissed: {}, Hidden: {} });
export type OutMessage = typeof OutMessage.Type;
export const init = ({
  id,
  open = true,
}: {
  readonly id: string;
  readonly open?: boolean;
}): Model => Animation.init({ id, isShowing: open });
export function update(
  model: Model,
  message: Message,
  options: { readonly controlled?: boolean } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message._tag === 'Dismissed' && (!model.isShowing || options.controlled))
    return { model, outMessage: model.isShowing ? OutMessage.Dismissed() : undefined };
  const event =
    message._tag === 'Animation'
      ? message.message
      : message._tag === 'Showed'
        ? Animation.Message.Showed()
        : Animation.Message.Hid();
  const result = Animation.update(model, event);
  // Motion's row/opacity/scale share a progress value. Its scoped runtime
  // reports settlement; a CSS-only settlement check would finish too early.
  const customSettlement =
    event._tag === 'CompletedWaitForPaint' && result.model.transitionState === 'EnterAnimating';
  return {
    model: result.model,
    commands: customSettlement
      ? []
      : (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Animation({ message })),
        ),
    outMessage:
      message._tag === 'Dismissed'
        ? OutMessage.Dismissed()
        : result.outMessage?._tag === 'TransitionedOut'
          ? OutMessage.Hidden()
          : undefined,
  };
}
