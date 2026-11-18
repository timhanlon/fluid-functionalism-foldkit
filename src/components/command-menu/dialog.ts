import { Schema } from 'effect';
import { Command, Submodel, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as DialogBase from '../dialog';
import { Message as MenuMessage } from './messages';
export { shortcut, type ShortcutOptions } from './shortcut-runtime';
import * as Menu from './index';

/** The modal shell, as upstream's CommandMenuDialog: a top-anchored dialog
 * whose field takes focus on open. Picking a row closes it; closing resets
 * the menu, because upstream's content unmounts and a reopened palette
 * starts clean. The page binds the opening combo through `shortcut`. */
export const Model = Schema.Struct({ dialog: DialogBase.Model, menu: Menu.Model });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const init = (config: { readonly id: string }): Model => ({
  dialog: DialogBase.init({ id: `${config.id}-dialog` }),
  menu: Menu.init({ id: config.id }),
});
export const Message = defineMessageUnion({
  Dialog: { message: DialogBase.Message },
  Menu: { message: MenuMessage },
  /** The trigger combo or a trigger button: open when closed, else close. */
  Toggled: {},
  Opened: {},
});
export type Message = typeof Message.Type;
export const OutMessage = Menu.OutMessage;
export type OutMessage = Menu.OutMessage;
export interface UpdateOptions extends Menu.UpdateOptions {
  /** Picking a row closes the dialog. Defaults to true. */
  readonly closeOnSelect?: boolean;
}

export function update(
  model: Model,
  message: Message,
  options: UpdateOptions,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  const dialog = (inner: DialogBase.Message, menu = model.menu) => {
    const result = DialogBase.update(model.dialog, inner);
    const closed = result.outMessage?._tag === 'Closed';
    return {
      model: { dialog: result.model, menu: closed ? Menu.init({ id: menu.id }) : menu },
      commands: (result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) => Message.Dialog({ message })),
      ),
    };
  };
  switch (message._tag) {
    case 'Dialog':
      return dialog(message.message);
    case 'Toggled':
      return dialog(
        model.dialog.isOpen
          ? DialogBase.Message.RequestedClose()
          : DialogBase.Message.RequestedOpen(),
      );
    case 'Opened':
      return model.dialog.isOpen ? { model } : dialog(DialogBase.Message.RequestedOpen());
    case 'Menu': {
      const result = Menu.update(model.menu, message.message, options);
      const commands = (result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) => Message.Menu({ message })),
      );
      if (result.outMessage?._tag === 'Selected' && options.closeOnSelect !== false) {
        const closing = dialog(DialogBase.Message.RequestedClose(), result.model);
        return {
          model: closing.model,
          commands: [...commands, ...closing.commands],
          outMessage: result.outMessage,
        };
      }
      return {
        model: { ...model, menu: result.model },
        commands,
        ...(result.outMessage ? { outMessage: result.outMessage } : {}),
      };
    }
  }
}

export interface Props extends Omit<Menu.Props, 'inDialog'> {
  /** Read to screen readers as the dialog's name. */
  readonly title?: string;
  readonly description?: string;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const { title, description, ...menu } = props;
  return h.div(
    [h.Class('contents')],
    [
      h.span(
        [
          h.Id(`${model.menu.id}-shortcut-anchor`),
          h.Hidden(true),
          h.DataAttribute('command-menu-open', String(model.dialog.isOpen)),
        ],
        [],
      ),
      h.submodel({
        slotId: 'dialog',
        model: model.dialog,
        view: DialogBase.view,
        toParentMessage: (message) => Message.Dialog({ message }),
        viewInputs: {
          title: title ?? 'Command menu',
          description: description ?? 'Search for a command to run.',
          hideTrigger: true,
          hideHeader: true,
          showCloseButton: false,
          width: 'lg',
          position: 'top',
          className: 'ff-command-dialog',
          ...(props.size ? { size: props.size } : {}),
          ...(props.radius ? { radius: props.radius } : {}),
          renderContent: ({ initialFocus }) =>
            h.submodel({
              slotId: 'menu',
              model: model.menu,
              view: Menu.view,
              toParentMessage: (message) => Message.Menu({ message }),
              viewInputs: { ...menu, inDialog: true, inputAttributes: initialFocus },
            }),
        },
      }),
    ],
  );
});
