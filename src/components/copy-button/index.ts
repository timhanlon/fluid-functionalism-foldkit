import { Effect, Schema } from 'effect';
import { Command, Submodel, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as Button from '../button';
import { icon } from '../icons';
import { writeClipboard } from './clipboard';
import './styles.css';

export const Model = Schema.Struct({
  copied: Schema.Boolean,
  revision: Schema.Number,
  unmountedThrough: Schema.Number,
  feedbackRevision: Schema.Number,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Clicked: {},
  Unmounted: {},
  Completed: { revision: Schema.Number, success: Schema.Boolean },
  Cleared: { revision: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({ Copied: {} });
export type OutMessage = typeof OutMessage.Type;
export const init = (): Model => ({
  copied: false,
  revision: 0,
  unmountedThrough: 0,
  feedbackRevision: 0,
});
export const Copy = Command.define('CopyButton.Copy', {
  args: { text: Schema.String, revision: Schema.Number },
  messages: [Message.Completed],
  execute: ({ text, revision }) =>
    Effect.tryPromise(() => writeClipboard(text)).pipe(
      Effect.map(() => Message.Completed({ revision, success: true })),
      Effect.catch(() => Effect.succeed(Message.Completed({ revision, success: false }))),
    ),
});
export const Clear = Command.define('CopyButton.Clear', {
  args: { revision: Schema.Number },
  messages: [Message.Cleared],
  execute: ({ revision }) =>
    Effect.sleep('2 seconds').pipe(Effect.as(Message.Cleared({ revision }))),
});
export function update(
  model: Model,
  message: Message,
  text: string,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message._tag === 'Unmounted')
    return {
      model: {
        ...init(),
        revision: model.revision,
        unmountedThrough: model.revision,
        feedbackRevision: model.feedbackRevision + 1,
      },
    };
  if (message._tag === 'Clicked') {
    const revision = model.revision + 1;
    return { model: { ...model, revision }, commands: [Copy({ text, revision })] };
  }
  if (message._tag === 'Cleared')
    return {
      model: message.revision === model.feedbackRevision ? { ...model, copied: false } : model,
    };
  if (message.revision <= 0 || message.revision > model.revision) return { model };
  if (!message.success) return { model };
  // CopyPromptButton's awaited handler still calls onCopy after removal;
  // its old state setters cannot change a newly mounted button's feedback.
  if (message.revision <= model.unmountedThrough) return { model, outMessage: OutMessage.Copied() };
  const feedbackRevision = model.feedbackRevision + 1;
  return {
    model: { ...model, copied: true, feedbackRevision },
    outMessage: OutMessage.Copied(),
    commands: [Clear({ revision: feedbackRevision })],
  };
}
export interface Props {
  readonly label?: string;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly variant?: Button.Variant;
  readonly icons?: string;
  readonly className?: string;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) =>
  Button.view(
    {
      children: [
        props.label ?? 'Copy prompt',
        model.copied ? h.span([h.Class('ff-copy-announcement')], ['Copied']) : null,
      ],
      onClick: Message.Clicked(),
      size: props.size,
      radius: props.radius,
      variant: props.variant,
      className: `ff-copy-button ${props.className ?? ''}`,
      attributes: [h.Attribute('aria-live', 'polite'), h.OnUnmount(Message.Unmounted())],
      leadingIcon: h.span(
        [
          h.Class('ff-copy-icon'),
          h.DataAttribute('copied', String(model.copied)),
          h.AriaHidden(true),
        ],
        [
          h.span([h.Class('ff-copy-glyph')], [icon('copy', props.icons, h)]),
          h.span([h.Class('ff-copy-check')], [icon('check', props.icons, h)]),
        ],
      ),
    },
    h,
  ),
);
