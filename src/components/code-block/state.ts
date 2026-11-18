import { Tooltip as PrimitiveTooltip } from '@foldkit/ui';
import { Effect, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as Tooltip from '../tooltip';
import { writeClipboard } from '../copy-button/clipboard';
export const Model = Schema.Struct({
  tooltip: Tooltip.Model,
  shown: Schema.Boolean,
  result: Schema.Literals(['copied', 'error']),
  revision: Schema.Number,
  feedbackRevision: Schema.Number,
  unmountedThrough: Schema.Number,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  CopyRequested: {},
  CopyCompleted: { revision: Schema.Number, success: Schema.Boolean },
  FeedbackCleared: { revision: Schema.Number },
  Tooltip: { message: Tooltip.Message },
  Unmounted: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({ Copied: {} });
export type OutMessage = typeof OutMessage.Type;
export const init = ({ id }: { readonly id: string }): Model => ({
  tooltip: Tooltip.init({ id: `${id}-copy` }),
  shown: false,
  result: 'copied',
  revision: 0,
  feedbackRevision: 0,
  unmountedThrough: 0,
});
export const Copy = Command.define('CodeBlock.Copy', {
  args: { text: Schema.String, revision: Schema.Number },
  messages: [Message.CopyCompleted],
  execute: ({ text, revision }) =>
    Effect.tryPromise(() => writeClipboard(text)).pipe(
      Effect.map(() => Message.CopyCompleted({ revision, success: true })),
      Effect.catch(() => Effect.succeed(Message.CopyCompleted({ revision, success: false }))),
    ),
});
export const Clear = Command.define('CodeBlock.ClearFeedback', {
  args: { revision: Schema.Number },
  messages: [Message.FeedbackCleared],
  execute: ({ revision }) =>
    Effect.sleep('2 seconds').pipe(Effect.as(Message.FeedbackCleared({ revision }))),
});
export function update(
  model: Model,
  message: Message,
  props: { readonly code: string },
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message._tag === 'Tooltip') {
    const result = Tooltip.update(model.tooltip, message.message);
    return {
      model: { ...model, tooltip: result.model },
      commands: result.commands?.map((command) =>
        Command.mapMessage(command, (message) => Message.Tooltip({ message })),
      ),
    };
  }
  if (message._tag === 'Unmounted')
    return {
      model: {
        ...model,
        shown: false,
        feedbackRevision: model.feedbackRevision + 1,
        unmountedThrough: model.revision,
        tooltip: Tooltip.update(model.tooltip, Tooltip.Message.Unmounted()).model,
      },
    };
  if (message._tag === 'CopyRequested') {
    const revision = model.revision + 1;
    const tip = model.tooltip.tooltip;
    const dismissed =
      tip.isHovered || tip.isFocused || tip.isOpen
        ? Tooltip.update(
            model.tooltip,
            Tooltip.Message.PrimitiveMessage({ message: PrimitiveTooltip.Message.PressedEscape() }),
          )
        : { model: model.tooltip };
    return {
      model: { ...model, tooltip: dismissed.model, revision },
      commands: [
        Copy({ text: props.code, revision }),
        ...(dismissed.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Tooltip({ message })),
        ),
      ],
    };
  }
  if (message._tag === 'FeedbackCleared')
    return {
      model: message.revision === model.feedbackRevision ? { ...model, shown: false } : model,
    };
  if (message.revision <= 0 || message.revision > model.revision) return { model };
  const outMessage = message.success ? OutMessage.Copied() : undefined;
  if (message.revision <= model.unmountedThrough) return { model, outMessage };
  const feedbackRevision = model.feedbackRevision + 1;
  return {
    model: {
      ...model,
      shown: true,
      result: message.success ? 'copied' : 'error',
      feedbackRevision,
    },
    outMessage,
    commands: [Clear({ revision: feedbackRevision })],
  };
}
