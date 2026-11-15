import { Effect, Schema } from 'effect';
import { Button as PrimitiveButton, Tooltip as PrimitiveTooltip } from '@foldkit/ui';
import { Command, Submodel, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { ChildAttribute } from 'foldkit/html';
import * as Tooltip from '../tooltip';
import { writeClipboard } from '../copy-button/clipboard';
import { icon } from '../icons';
import './styles.css';

export const Model = Schema.Struct({
  tooltip: Tooltip.Model,
  status: Schema.Literals(['idle', 'copied', 'error']),
  visualStatus: Schema.Literals(['idle', 'copied', 'error']),
  visualRevision: Schema.Number,
  transitionRevision: Schema.Number,
  visualExiting: Schema.Boolean,
  revision: Schema.Number,
  unmountedThrough: Schema.Number,
  feedbackRevision: Schema.Number,
  tooltipState: Schema.Literals(['idle', 'copied', 'suppressed']),
  tooltipWasVisible: Schema.Boolean,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Tooltip: { message: Tooltip.Message },
  Clicked: {},
  Unmounted: {},
  RowEntered: {},
  RowLeft: {},
  Completed: { revision: Schema.Number, success: Schema.Boolean },
  Cleared: { revision: Schema.Number },
  Swapped: { revision: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({ Copied: {} });
export type OutMessage = typeof OutMessage.Type;
export const init = ({ id }: { readonly id: string }): Model => ({
  tooltip: Tooltip.init({ id, showDelay: '500 millis' }),
  status: 'idle',
  visualStatus: 'idle',
  visualRevision: 0,
  transitionRevision: 0,
  visualExiting: false,
  revision: 0,
  unmountedThrough: 0,
  feedbackRevision: 0,
  tooltipState: 'idle',
  tooltipWasVisible: false,
});
export const Copy = Command.define('InputCopy.Copy', {
  args: { value: Schema.String, revision: Schema.Number },
  messages: [Message.Completed],
  execute: ({ value, revision }) =>
    Effect.tryPromise(() => writeClipboard(value)).pipe(
      Effect.map(() => Message.Completed({ revision, success: true })),
      Effect.catch(() => Effect.succeed(Message.Completed({ revision, success: false }))),
    ),
});
export const Clear = Command.define('InputCopy.Clear', {
  args: { revision: Schema.Number },
  messages: [Message.Cleared],
  execute: ({ revision }) =>
    Effect.sleep('2 seconds').pipe(Effect.as(Message.Cleared({ revision }))),
});
export const Swap = Command.define('InputCopy.Swap', {
  args: { revision: Schema.Number },
  messages: [Message.Swapped],
  execute: ({ revision }) =>
    Effect.sleep('60 millis').pipe(Effect.as(Message.Swapped({ revision }))),
});
function transition(model: Model, status: Model['status']) {
  const revision = model.transitionRevision + 1;
  return {
    model: { ...model, status, transitionRevision: revision, visualExiting: true },
    commands: [Swap({ revision })],
  };
}
function controlled(
  model: Tooltip.Model,
  state: Model['tooltipState'],
  disabled = false,
): ReturnType<typeof Tooltip.update> {
  const value = disabled || state === 'suppressed' ? false : state === 'copied' ? true : null;
  return model.forceOpen === value
    ? { model }
    : Tooltip.update(model, Tooltip.Message.ControlledOpenChanged({ value }));
}
const tooltipCommands = (commands: readonly Command.Command<Tooltip.Message>[] = []) =>
  commands.map((command) => Command.mapMessage(command, (message) => Message.Tooltip({ message })));
export function update(
  model: Model,
  message: Message,
  value: string,
  options: { readonly disabled?: boolean } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message._tag === 'Unmounted')
    return {
      model: {
        ...init({ id: model.tooltip.tooltip.id }),
        tooltip: Tooltip.update(model.tooltip, Tooltip.Message.Unmounted()).model,
        revision: model.revision,
        unmountedThrough: model.revision,
        feedbackRevision: model.feedbackRevision + 1,
        transitionRevision: model.transitionRevision + 1,
      },
    };
  if (message._tag === 'RowEntered' || message._tag === 'RowLeft') {
    const tooltipState =
      message._tag === 'RowEntered' && model.tooltipState === 'suppressed'
        ? 'idle'
        : message._tag === 'RowLeft' && model.tooltipState === 'copied'
          ? 'suppressed'
          : model.tooltipState;
    if (tooltipState === model.tooltipState) return { model };
    const control = controlled(model.tooltip, tooltipState, options.disabled);
    return {
      model: { ...model, tooltipState, tooltip: control.model },
      commands: tooltipCommands(control.commands),
    };
  }
  if (message._tag === 'Swapped')
    return {
      model:
        message.revision === model.transitionRevision
          ? {
              ...model,
              visualStatus: model.status,
              visualRevision: model.transitionRevision,
              visualExiting: false,
            }
          : model,
    };
  if (message._tag === 'Tooltip') {
    const event =
      message.message._tag === 'PrimitiveMessage' ? message.message.message._tag : undefined;
    const result = Tooltip.update(model.tooltip, message.message);
    const control = controlled(result.model, model.tooltipState, options.disabled);
    return {
      model: {
        ...model,
        tooltipWasVisible:
          event === 'PressedPointerOnTrigger'
            ? model.tooltip.tooltip.isOpen
            : model.tooltipWasVisible,
        tooltip: control.model,
      },
      commands: tooltipCommands([...(result.commands ?? []), ...(control.commands ?? [])]),
    };
  }
  if (message._tag === 'Clicked') {
    if (options.disabled) return { model };
    const revision = model.revision + 1;
    return { model: { ...model, revision }, commands: [Copy({ value, revision })] };
  }
  if (message._tag === 'Cleared') {
    if (message.revision !== model.feedbackRevision) return { model };
    const result = transition(model, 'idle');
    const control = controlled(model.tooltip, 'suppressed', options.disabled);
    return {
      ...result,
      model: { ...result.model, tooltipState: 'suppressed', tooltip: control.model },
      commands: [...result.commands, ...tooltipCommands(control.commands)],
    };
  }
  if (message.revision <= 0 || message.revision > model.revision) return { model };
  // React ignores the old instance's state setters after unmount, but the
  // awaited handler still calls onCopy for a successful clipboard write.
  if (message.revision <= model.unmountedThrough)
    return { model, outMessage: message.success ? OutMessage.Copied() : undefined };
  // Fluid applies clipboard results in completion order, including a write
  // started before a newer one. Each completion restarts the feedback window.
  const feedbackRevision = model.feedbackRevision + 1;
  const tooltipState = model.tooltipWasVisible ? 'copied' : 'suppressed';
  const control = controlled(model.tooltip, tooltipState, options.disabled);
  const result = transition(model, message.success ? 'copied' : 'error');
  return {
    model: {
      ...result.model,
      feedbackRevision,
      tooltipState,
      tooltip: control.model,
    },
    outMessage: message.success ? OutMessage.Copied() : undefined,
    commands: [
      ...result.commands,
      Clear({ revision: feedbackRevision }),
      ...tooltipCommands(control.commands),
    ],
  };
}
export interface Props {
  readonly value: string;
  readonly label?: string;
  readonly disabled?: boolean;
  readonly variant?: 'icon' | 'button';
  readonly align?: 'left' | 'right';
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly className?: string;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const id = PrimitiveTooltip.triggerId(model.tooltip.tooltip.id);
  const labelId = `${id}-label`;
  const statusLabel =
    model.status === 'copied'
      ? 'Copied'
      : model.status === 'error'
        ? 'Copy failed'
        : props.label
          ? 'Copy'
          : 'Copy to clipboard';
  const renderButton = (attributes: readonly ChildAttribute[] = []) =>
    PrimitiveButton.view(
      {
        onClick: Message.Clicked(),
        isDisabled: props.disabled,
        type: 'button',
        toView: ({ button }) => {
          const action = h.span(
            [h.Class('ff-input-copy-action'), h.AriaHidden(true)],
            [
              h.span(
                [h.Class('ff-input-copy-glyph'), h.Key(`result-${model.visualRevision}`)],
                [
                  model.visualStatus === 'idle'
                    ? icon('copy', props.icons, h)
                    : h.svg(
                        [
                          h.Attribute('width', '14'),
                          h.Attribute('height', '14'),
                          h.Attribute('viewBox', '2 4 20 16'),
                          h.Attribute('fill', 'none'),
                          h.Attribute('stroke', 'currentColor'),
                          h.Attribute('stroke-linecap', 'round'),
                          h.Attribute('stroke-linejoin', 'round'),
                        ],
                        [
                          h.path(
                            [
                              h.Attribute(
                                'd',
                                model.visualStatus === 'copied'
                                  ? 'M6 12L10 16L18 8'
                                  : 'M9 9L15 15M15 9L9 15',
                              ),
                              h.Attribute('pathLength', '1'),
                            ],
                            [],
                          ),
                        ],
                      ),
                ],
              ),
              props.variant === 'button'
                ? h.span(
                    [h.Class('ff-input-copy-action-label'), h.Key(`label-${model.visualRevision}`)],
                    [
                      h.span([h.Class('ff-input-copy-reserved')], ['Copied']),
                      h.span(
                        [],
                        [
                          model.visualStatus === 'copied'
                            ? 'Copied'
                            : model.visualStatus === 'error'
                              ? 'Failed'
                              : 'Copy',
                        ],
                      ),
                    ],
                  )
                : null,
            ],
          );
          const value = h.span([h.Class('ff-input-copy-value')], [h.mark([], [props.value])]);
          return h.button(
            [
              ...button,
              ...attributes,
              h.Id(id),
              h.Class('ff-input-copy-button'),
              h.AriaLabel(props.label ? `${statusLabel} ${props.label}` : statusLabel),
            ],
            props.align === 'left' ? [action, value] : [value, action],
          );
        },
      },
      h,
    );
  return h.div(
    [
      h.Class(`ff-input-copy ${props.className ?? ''}`),
      h.OnUnmount(Message.Unmounted()),
      h.OnMouseEnter(Message.RowEntered()),
      h.OnMouseLeave(Message.RowLeft()),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('align', props.align ?? 'right'),
      h.DataAttribute('variant', props.variant ?? 'icon'),
      h.DataAttribute('status', model.status),
      h.DataAttribute('visual-status', model.visualStatus),
      h.DataAttribute('exiting', String(model.visualExiting)),
      h.DataAttribute('animated', String(model.visualRevision > 0)),
      ...(props.disabled ? [h.DataAttribute('disabled', '')] : []),
    ],
    [
      props.label ? h.span([h.Id(labelId), h.Class('ff-input-copy-label')], [props.label]) : null,
      props.variant === 'button'
        ? renderButton()
        : h.submodel({
            slotId: 'tooltip',
            model: model.tooltip,
            view: Tooltip.view,
            toParentMessage: (message) => Message.Tooltip({ message }),
            viewInputs: {
              content: model.status === 'idle' ? 'Copy to clipboard' : statusLabel,
              sideOffset: 2,
              radius: props.radius,
              disabled: props.disabled,
              forceOpen:
                props.disabled || model.tooltipState === 'suppressed'
                  ? false
                  : model.tooltipState === 'copied'
                    ? true
                    : undefined,
              renderTrigger: renderButton,
            },
          }),
    ],
  );
});
