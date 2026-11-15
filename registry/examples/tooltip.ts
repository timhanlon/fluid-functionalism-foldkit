import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Tooltip from './fluid/components/tooltip';

export const Model = Schema.Struct({ tooltip: Tooltip.Model, shown: Schema.Boolean });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Tooltip: { message: Tooltip.Message },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: { tooltip: Tooltip.init({ id: 'project-details', showDelay: '100 millis' }), shown: true },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Tooltip': {
      const result = Tooltip.update(model.tooltip, message.message);
      return {
        model: { ...model, tooltip: result.model },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Tooltip({ message })),
        ),
      };
    }
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Tooltip example',
    body: h.main(
      [],
      [
        h.h1([], ['Tooltip']),
        model.shown
          ? h.submodel({
              slotId: 'details',
              model: model.tooltip,
              view: Tooltip.view,
              toParentMessage: (message) => Message.Tooltip({ message }),
              viewInputs: {
                content: 'Project details',
                side: 'bottom',
                renderTrigger: (attributes) =>
                  h.button([h.Type('button'), ...attributes], ['Details']),
              },
            })
          : null,
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide tooltip' : 'Show tooltip'],
        ),
      ],
    ),
  };
}
