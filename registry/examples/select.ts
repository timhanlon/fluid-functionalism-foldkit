import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Select from './fluid/components/select';

export const Model = Schema.Struct({ select: Select.Model, plan: Schema.String });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ Select: { message: Select.Message } });
export type Message = typeof Message.Type;
export const init = () => ({
  model: { select: Select.init({ id: 'example-plan' }), plan: 'personal' },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Select': {
      const result = Select.update(model.select, message.message);
      return {
        model: {
          ...model,
          select: result.model,
          plan: result.outMessage?._tag === 'Selected' ? result.outMessage.value : model.plan,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Select({ message })),
        ),
      };
    }
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Select example',
    body: h.main(
      [],
      [
        h.h1([], ['Select']),
        h.submodel({
          slotId: 'plan',
          model: model.select,
          view: Select.view,
          toParentMessage: (message) => Message.Select({ message }),
          viewInputs: {
            label: 'Plan',
            value: model.plan,
            items: [
              { value: 'personal', label: 'Personal' },
              { value: 'team', label: 'Team' },
            ],
          },
        }),
        h.p([h.Attribute('aria-live', 'polite')], [`Selected plan: ${model.plan}`]),
      ],
    ),
  };
}
