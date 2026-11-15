import { Schema, Effect, Queue, Stream } from 'effect';
import { Command, Mount, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { Tooltip as Primitive } from '@foldkit/ui';
import { spring, exitFallbackMs } from '../motion';
export const Model = Schema.Struct({
  tooltip: Primitive.Model,
  panelPresent: Schema.Boolean,
  version: Schema.Number,
  forceOpen: Schema.NullOr(Schema.Boolean),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  PrimitiveMessage: { message: Primitive.Message },
  ExitFinished: { version: Schema.Number },
  ControlledOpenChanged: { value: Schema.NullOr(Schema.Boolean) },
  Unmounted: {},
});
export type Message = typeof Message.Type;
export type OutMessage = Primitive.OutMessage;
export type InitConfig = Primitive.InitConfig;
export const init = (config: InitConfig): Model => ({
  tooltip: Primitive.init({ ...config, showDelay: config.showDelay ?? '200 millis' }),
  panelPresent: false,
  version: 0,
  forceOpen: null,
});
/** Fluid's exiting label stays mounted after the primitive closes. */
export const FinishExit = Command.define('FluidTooltip.FinishExit', {
  args: { version: Schema.Number },
  messages: [Message.ExitFinished],
  execute: ({ version }) =>
    Effect.sleep(exitFallbackMs(spring.fast)).pipe(Effect.as(Message.ExitFinished({ version }))),
});
export function update(
  model: Model,
  message: Message,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message._tag === 'Unmounted') {
    const fresh = init({ id: model.tooltip.id, showDelay: model.tooltip.showDelay });
    return {
      model: {
        ...fresh,
        tooltip: { ...fresh.tooltip, pendingShowVersion: model.tooltip.pendingShowVersion + 1 },
        version: model.version + 1,
      },
    };
  }
  if (message._tag === 'ExitFinished')
    return {
      model:
        message.version === model.version && !(model.forceOpen ?? model.tooltip.isOpen)
          ? { ...model, panelPresent: false }
          : model,
    };
  const result =
    message._tag === 'PrimitiveMessage'
      ? Primitive.update(model.tooltip, message.message)
      : { model: model.tooltip };
  const forceOpen = message._tag === 'ControlledOpenChanged' ? message.value : model.forceOpen;
  const open = forceOpen ?? result.model.isOpen;
  const changed = open !== (model.forceOpen ?? model.tooltip.isOpen);
  const version = model.version + (changed ? 1 : 0);
  return {
    model: { tooltip: result.model, forceOpen, version, panelPresent: open || model.panelPresent },
    commands: [
      ...(result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) => Message.PrimitiveMessage({ message })),
      ),
      ...(changed && !open ? [FinishExit({ version })] : []),
    ],
    outMessage: result.outMessage,
  };
}
/** Reflect controlled props after the DOM commit, retaining the model-owned
 * exit lifetime even when forceOpen changes without an input Message. */
export const ControlledOpen = Mount.defineStream('Tooltip.ControlledOpen', {
  messages: [Message.ControlledOpenChanged],
  execute: ({ element }) =>
    Stream.callback<typeof Message.ControlledOpenChanged.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          let previous: string | undefined;
          const sync = () => {
            const value = element.getAttribute('data-tooltip-force-open') ?? 'auto';
            if (value === previous) return;
            previous = value;
            Queue.offerUnsafe(
              queue,
              Message.ControlledOpenChanged({
                value: value === 'auto' ? null : value === 'true',
              }),
            );
          };
          const observer = new MutationObserver(sync);
          observer.observe(element, {
            attributes: true,
            attributeFilter: ['data-tooltip-force-open'],
          });
          sync();
          return () => observer.disconnect();
        }),
        (release) => Effect.sync(release),
      ),
    ),
});
