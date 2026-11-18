import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Dropdown from './fluid/components/dropdown';

export const Model = Schema.Struct({
  menu: Dropdown.Model,
  action: Schema.String,
  leading: Schema.Number,
  single: Schema.String,
  multiple: Schema.Array(Schema.String),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Menu: { message: Dropdown.Message },
  LeadingClicked: {},
  SinglePicked: { value: Schema.String },
  MultiplePicked: { value: Schema.String },
  InlinePicked: { value: Schema.String },
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: {
    menu: Dropdown.init({ id: 'example-actions' }),
    action: 'none',
    leading: 0,
    single: '',
    multiple: [],
  },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'LeadingClicked':
      return { model: { ...model, leading: model.leading + 1 } };
    case 'SinglePicked':
      return { model: { ...model, single: message.value } };
    case 'MultiplePicked':
      return {
        model: {
          ...model,
          multiple: model.multiple.includes(message.value)
            ? model.multiple.filter((value) => value !== message.value)
            : [...model.multiple, message.value],
        },
      };
    case 'InlinePicked':
      return { model: { ...model, action: message.value } };
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
  const leading = (label: string) =>
    h.button(
      [
        h.Type('button'),
        h.AriaLabel(label),
        h.OnClick(Message.LeadingClicked()),
        h.Style({
          width: '20px',
          height: '20px',
          padding: '0',
          border: '0',
          background: 'transparent',
          color: 'inherit',
        }),
      ],
      ['⋮'],
    );
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
            renderLeading: (item) => (item.value === 'open' ? leading('Inspect popup') : null),
            items: [
              { value: 'open', label: 'Open' },
              { value: 'archive', label: 'Archive' },
              { value: 'delete', label: 'Delete', disabled: true, destructive: true },
              {
                value: 'purge',
                label: 'Delete permanently',
                destructive: true,
                shortcut: '⌘⌫',
                icon: h.svg(
                  [
                    h.ViewBox('0 0 24 24'),
                    h.Fill('none'),
                    h.Stroke('currentColor'),
                    h.StrokeLinecap('round'),
                    h.StrokeLinejoin('round'),
                  ],
                  [h.path([h.D('M3 6h18M19 6l-1 14H6L5 6m4 0V3h6v3m-5 4v6m4-6v6')], [])],
                ),
              },
            ],
            renderItemsHeader: () => h.div([h.Style({ padding: '8px' })], ['Workspace actions']),
          },
        }),
        Dropdown.Panel.view(
          {
            id: 'danger-zone',
            label: 'Danger zone',
            selection: { mode: 'none' },
            items: [
              { value: 'keep', label: 'Keep data', leading: leading('Inspect inline') },
              { value: 'clear', label: 'Clear stored data', destructive: true },
            ],
            onSelect: (value) => Message.InlinePicked({ value }),
          },
          h,
        ),
        Dropdown.Panel.view(
          {
            id: 'single-leading',
            label: 'Single preference',
            radius: 'sharp',
            selection: { mode: 'single', value: model.single },
            items: [
              { value: 'first', label: 'First choice', leading: leading('Inspect single') },
              { value: 'second', label: 'Second choice' },
            ],
            onSelect: (value) => Message.SinglePicked({ value }),
          },
          h,
        ),
        Dropdown.Panel.view(
          {
            id: 'multiple-leading',
            label: 'Flag preferences',
            size: 'compact',
            radius: 'sharp',
            selection: { mode: 'multiple', values: model.multiple },
            items: [{ value: 'flag', label: 'Flag entry', leading: leading('Inspect flag') }],
            onSelect: (value) => Message.MultiplePicked({ value }),
          },
          h,
        ),
        h.p([], [`Leading actions: ${model.leading}`]),
        h.p([h.Attribute('aria-live', 'polite')], [`Last action: ${model.action}`]),
      ],
    ),
  };
}
