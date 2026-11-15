import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Tabs from './fluid/components/tabs';
const items = [
  { value: 'overview', label: 'Overview' },
  { value: 'locked', label: 'Unavailable', disabled: true },
  { value: 'reports', label: 'Reports' },
];

export const Model = Schema.Struct({
  control: Tabs.Model,
  value: Schema.String,
  count: Schema.Number,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Control: { message: Tabs.Message },
  Incremented: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: { control: Tabs.init({ id: 'registry-tabs' }), value: 'overview', count: 0, shown: true },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Control': {
      const result = Tabs.update(model.control, message.message);
      return {
        model: { ...model, control: result.model, value: result.outMessage?.value ?? model.value },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Control({ message })),
        ),
      };
    }
    case 'Incremented':
      return { model: { ...model, count: model.count + 1 } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Tabs example',
    body: h.main(
      [],
      [
        h.h1([], ['Tabs']),
        model.shown
          ? h.submodel({
              slotId: 'tabs',
              model: model.control,
              view: Tabs.view,
              toParentMessage: (message) => Message.Control({ message }),
              viewInputs: {
                items,
                label: 'Workspace tabs',
                value: model.value,
                panel: (value) =>
                  h.div(
                    [],
                    [
                      h.p([], [`Panel: ${value}`]),
                      h.button(
                        [h.Type('button'), h.OnClick(Message.Incremented())],
                        [`Panel clicks: ${model.count}`],
                      ),
                    ],
                  ),
              },
            })
          : null,
        h.p([], [`Selected: ${model.value}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide control' : 'Show control'],
        ),
      ],
    ),
  };
}
