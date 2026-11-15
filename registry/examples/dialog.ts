import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Dialog from './fluid/components/dialog';

export const Model = Schema.Struct({
  dialog: Dialog.Model,
  name: Schema.String,
  ready: Schema.Boolean,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Dialog: { message: Dialog.Message },
  NameChanged: { value: Schema.String },
  Ready: {},
  Removed: {},
  Restored: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: { dialog: Dialog.init({ id: 'project-editor' }), name: '', ready: false, shown: true },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Dialog': {
      const result = Dialog.update(model.dialog, message.message);
      return {
        model: { ...model, dialog: result.model },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Dialog({ message })),
        ),
      };
    }
    case 'NameChanged':
      return { model: { ...model, name: message.value } };
    case 'Ready':
      return { model: { ...model, ready: true } };
    case 'Removed':
      // Keep the child Model so its Unmounted lifecycle Message can release
      // native modal resources before the same component is shown again.
      return { model: { ...model, shown: false } };
    case 'Restored':
      return { model: { ...model, shown: true } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Dialog example',
    body: h.main(
      [],
      [
        h.h1([], ['Dialog']),
        model.shown
          ? h.submodel({
              slotId: 'editor',
              model: model.dialog,
              view: Dialog.view,
              toParentMessage: (message) => Message.Dialog({ message }),
              viewInputs: {
                title: 'Edit project',
                triggerLabel: 'Edit project',
                description: 'Update the project name.',
                width: 'sm',
                renderContent: (slots) =>
                  h.div(
                    [],
                    [
                      h.label([h.For('project-name')], ['Project name']),
                      h.input([
                        h.Id('project-name'),
                        h.Value(model.name),
                        h.OnInput((value) => Message.NameChanged({ value })),
                        ...slots.initialFocus,
                      ]),
                      h.button([h.Type('button'), h.OnClick(Message.Ready())], ['Mark ready']),
                      h.button([h.Type('button'), h.OnClick(Message.Removed())], ['Remove dialog']),
                    ],
                  ),
                renderFooter: (slots) =>
                  h.button([h.Type('button'), ...slots.closeButton], ['Done']),
              },
            })
          : h.button([h.Type('button'), h.OnClick(Message.Restored())], ['Restore dialog']),
        h.p([], [`Project: ${model.name || 'unnamed'}; ready: ${model.ready}`]),
        h.button([h.Type('button'), h.OnClick(Message.Ready())], ['Background action']),
      ],
    ),
  };
}
