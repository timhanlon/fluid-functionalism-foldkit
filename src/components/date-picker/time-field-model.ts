import { Option, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { Popover } from '@foldkit/ui';
import * as Edit from './time-field-state';
export const Model = Schema.Struct({
  id: Schema.String,
  edit: Edit.Model,
  popover: Popover.Model,
  openTarget: Schema.Option(Schema.Number),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Edit: { message: Edit.Message },
  Popover: { message: Popover.Message },
  Noop: {},
});
export type Message = typeof Message.Type;
export const init = (id: string): Model => ({
  id,
  edit: Edit.init(),
  popover: Popover.init({
    id: `${id}-slots`,
    isAnimated: true,
    isModal: false,
    contentFocus: true,
  }),
  openTarget: Option.none(),
});
/** Preserve an epoch across removal/recreation so an old paint/exit command
 * cannot advance a later editing session with the same field id. */
export function reset(model: Model): Model {
  const fresh = init(model.id);
  return {
    ...fresh,
    popover: {
      ...fresh.popover,
      animation: {
        ...fresh.popover.animation,
        transitionGeneration: model.popover.animation.transitionGeneration + 1,
      },
    },
  };
}
const commands = (items: Update.Return<Popover.Model, Popover.Message>['commands']) =>
  (items ?? [])
    .filter((command) => command.name !== 'FocusButton')
    .map((command) => Command.mapMessage(command, (message) => Message.Popover({ message })));
export function update(
  model: Model,
  message: Message,
  options: Edit.Options,
): Update.ReturnWithOutMessage<Model, Message, Edit.OutMessage> {
  if (message._tag === 'Noop') return { model };
  if (message._tag === 'Popover') {
    const result = Popover.update(model.popover, message.message);
    const edit = result.model.isOpen
      ? model.edit
      : {
          ...model.edit,
          isOpen: false,
          draft: Option.none<string>(),
          activeIndex: Option.none<number>(),
        };
    return {
      model: { ...model, edit, popover: result.model },
      commands: commands(result.commands),
    };
  }
  const result = Edit.update(model.edit, message.message, options);
  const popup =
    result.model.isOpen === model.popover.isOpen
      ? { model: model.popover }
      : Popover.update(
          model.popover,
          result.model.isOpen ? Popover.Message.RequestedOpen() : Popover.Message.RequestedClose(),
        );
  return {
    model: {
      ...model,
      edit: result.model,
      popover: popup.model,
      openTarget:
        !model.edit.isOpen && result.model.isOpen && message.message._tag !== 'Changed'
          ? result.model.activeIndex
          : model.openTarget,
    },
    commands: commands(popup.commands),
    outMessage: result.outMessage,
  };
}
