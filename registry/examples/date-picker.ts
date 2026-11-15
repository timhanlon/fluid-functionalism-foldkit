import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Calendar from './fluid/components/calendar';
import * as DatePicker from './fluid/components/date-picker';

export const Model = Schema.Struct({ datePicker: DatePicker.Model, date: Calendar.Selection });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ DatePicker: { message: DatePicker.Message } });
export type Message = typeof Message.Type;
const props = { label: 'Appointment', mode: 'single', controlled: true } as const;
export const init = () => ({
  model: {
    datePicker: DatePicker.init({
      id: 'example-appointment',
      today: Calendar.fromNative(new Date()),
    }),
    date: Calendar.none(),
  },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'DatePicker': {
      const result = DatePicker.update(model.datePicker, message.message, {
        ...props,
        value: model.date,
      });
      return {
        model: {
          ...model,
          datePicker: result.model,
          date: result.outMessage?._tag === 'ValueChanged' ? result.outMessage.value : model.date,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.DatePicker({ message })),
        ),
      };
    }
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  const selected = Calendar.toSelected(model.date);
  return {
    title: 'DatePicker example',
    body: h.main(
      [],
      [
        h.h1([], ['DatePicker']),
        h.submodel({
          slotId: 'appointment',
          model: model.datePicker,
          view: DatePicker.view,
          toParentMessage: (message) => Message.DatePicker({ message }),
          viewInputs: { ...props, value: model.date },
        }),
        h.p(
          [h.Attribute('aria-live', 'polite')],
          [
            `Selected date: ${selected instanceof Date ? selected.toLocaleDateString('en-CA') : 'none'}`,
          ],
        ),
      ],
    ),
  };
}
