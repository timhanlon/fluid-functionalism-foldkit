import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Dropdown from './fluid/components/dropdown';

export const Model = Schema.Struct({ menu: Dropdown.Model, action: Schema.String });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ Menu: { message: Dropdown.Message } });
export type Message = typeof Message.Type;
export const init = () => ({
  model: { menu: Dropdown.init({ id: 'example-actions' }), action: 'none' },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Menu': {
      const result = Dropdown.update(model.menu, message.message);
      return {
        model: {
          ...model,
          menu: result.model,
          action: result.outMessage?._tag === 'Selected' ? result.outMessage.value : model.action,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Menu({ message })),
        ),
      };
    }
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Dropdown example',
    body: h.main(
      [],
      [
        h.h1([], ['Dropdown']),
        h.submodel({
          slotId: 'actions',
          model: model.menu,
          view: Dropdown.view,
          toParentMessage: (message) => Message.Menu({ message }),
          viewInputs: {
            label: 'Actions',
            items: [
              { value: 'open', label: 'Open' },
              { value: 'archive', label: 'Archive' },
              { value: 'delete', label: 'Delete', disabled: true },
            ],
            renderItemsHeader: () => h.div([h.Style({ padding: '8px' })], ['Workspace actions']),
          },
        }),
        h.p([h.Attribute('aria-live', 'polite')], [`Last action: ${model.action}`]),
      ],
    ),
  };
}
