import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Button from './fluid/components/button';
import * as Select from './fluid/components/select';
import * as Calendar from './fluid/components/calendar';
import * as DatePicker from './fluid/components/date-picker';

export const Model = Schema.Struct({
  count: Schema.Number,
  select: Select.Model,
  plan: Schema.String,
  datePicker: DatePicker.Model,
  date: Calendar.Selection,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Clicked: {},
  Select: { message: Select.Message },
  DatePicker: { message: DatePicker.Message },
});
export type Message = typeof Message.Type;
const dateProps = { label: 'Appointment', mode: 'single', controlled: true } as const;

export const init = () => ({
  model: {
    count: 0,
    select: Select.init({ id: 'starter-plan' }),
    plan: 'personal',
    datePicker: DatePicker.init({
      id: 'starter-appointment',
      today: Calendar.fromNative(new Date()),
    }),
    date: Calendar.none(),
  },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Clicked':
      return { model: { ...model, count: model.count + 1 } };
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
    case 'DatePicker': {
      const result = DatePicker.update(model.datePicker, message.message, {
        ...dateProps,
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
    title: 'Fluid Foldkit starter',
    body: h.main(
      [],
      [
        h.h1([], ['Fluid Foldkit']),
        h.p([], ['Editable components installed from the source registry.']),
        h.section(
          [],
          [
            h.h2([], ['Button']),
            Button.view(
              { children: [`Clicked ${model.count} times`], onClick: Message.Clicked() },
              h,
            ),
          ],
        ),
        h.section(
          [h.Class('starter-select')],
          [
            h.h2([], ['Select']),
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
                  { value: 'enterprise', label: 'Enterprise', disabled: true },
                ],
              },
            }),
            h.p(
              [h.Class('starter-status'), h.Attribute('aria-live', 'polite')],
              [`Selected plan: ${model.plan}`],
            ),
          ],
        ),
        h.section(
          [],
          [
            h.h2([], ['DatePicker']),
            h.submodel({
              slotId: 'appointment',
              model: model.datePicker,
              view: DatePicker.view,
              toParentMessage: (message) => Message.DatePicker({ message }),
              viewInputs: { ...dateProps, value: model.date },
            }),
            h.p(
              [h.Class('starter-status'), h.Attribute('aria-live', 'polite')],
              [
                `Selected date: ${selected instanceof Date ? selected.toLocaleDateString('en-CA') : 'none'}`,
              ],
            ),
          ],
        ),
      ],
    ),
  };
}
