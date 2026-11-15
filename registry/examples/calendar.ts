import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Calendar from './fluid/components/calendar';
import { Option } from 'effect';
const options = (selected: Calendar.Selection): Calendar.Options => ({
  mode: 'range',
  controlled: true,
  selected,
  min: 2,
  disabled: [new Date(2026, 10, 9)],
});
const key = (day: Calendar.Day) =>
  `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;

export const Model = Schema.Struct({
  calendar: Calendar.Model,
  selection: Calendar.Selection,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Calendar: { message: Calendar.Message },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    calendar: Calendar.init({
      id: 'booking',
      today: Calendar.day(2026, 11, 10),
      month: Calendar.day(2026, 11, 1),
    }),
    selection: Calendar.none(),
    shown: true,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Calendar': {
      const result = Calendar.update(model.calendar, message.message, options(model.selection));
      return {
        model: {
          ...model,
          calendar: result.model,
          selection:
            result.outMessage?._tag === 'Selected' ? result.outMessage.selection : model.selection,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Calendar({ message })),
        ),
      };
    }
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  const selected =
    model.selection._tag === 'Range'
      ? `${Option.isSome(model.selection.from) ? key(model.selection.from.value) : 'none'} to ${Option.isSome(model.selection.to) ? key(model.selection.to.value) : 'pending'}`
      : 'none';
  return {
    title: 'Calendar example',
    body: h.main(
      [],
      [
        h.h1([], ['Calendar']),
        model.shown
          ? h.submodel({
              slotId: 'booking',
              model: model.calendar,
              view: Calendar.view,
              toParentMessage: (message) => Message.Calendar({ message }),
              viewInputs: {
                ...options(model.selection),
                labels: () => ({ previousMonth: 'Previous month', nextMonth: 'Next month' }),
              },
            })
          : null,
        h.p([], [`Selection: ${selected}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide calendar' : 'Show calendar'],
        ),
      ],
    ),
  };
}
