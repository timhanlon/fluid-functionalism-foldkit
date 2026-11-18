import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as CommandMenu from './fluid/components/command-menu';
import * as CommandDialog from './fluid/components/command-menu/dialog';
import { Stream } from 'effect';
import { Subscription } from 'foldkit';
const items: readonly CommandMenu.Item[] = [
  { value: 'files', label: 'Open files', group: 'Navigate', keywords: ['documents'] },
  { value: 'settings', label: 'Settings', group: 'Navigate' },
  { value: 'delete', label: 'Delete workspace', group: 'Admin', disabled: true, destructive: true },
  { value: 'save', label: 'Save document', group: 'Actions', shortcut: 'mod+s' },
  {
    value: 'discard',
    label: 'Discard draft',
    description: 'Unsaved changes',
    group: 'Actions',
    destructive: true,
    shortcut: 'mod+Backspace',
  },
];

export const Model = Schema.Struct({
  menu: CommandMenu.Model,
  palette: CommandDialog.Model,
  embedded: CommandDialog.Model,
  selected: Schema.String,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Menu: { message: CommandMenu.Message },
  Palette: { message: CommandDialog.Message },
  Embedded: { message: CommandDialog.Message },
  PaletteToggled: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    menu: CommandMenu.init({ id: 'inline-commands' }),
    palette: CommandDialog.init({ id: 'palette' }),
    embedded: CommandDialog.init({ id: 'embedded-palette' }),
    selected: 'none',
    shown: true,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Menu': {
      const result = CommandMenu.update(model.menu, message.message, { items });
      return {
        model: {
          ...model,
          menu: result.model,
          selected:
            result.outMessage?._tag === 'Selected' ? result.outMessage.value : model.selected,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Menu({ message })),
        ),
      };
    }
    case 'Palette':
    case 'Embedded': {
      const key = message._tag === 'Palette' ? 'palette' : 'embedded';
      const wrap = message._tag === 'Palette' ? Message.Palette : Message.Embedded;
      const result = CommandDialog.update(model[key], message.message, { items });
      return {
        model: {
          ...model,
          [key]: result.model,
          selected:
            result.outMessage?._tag === 'Selected' ? result.outMessage.value : model.selected,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => wrap({ message })),
        ),
      };
    }
    case 'PaletteToggled':
      return update(model, Message.Palette({ message: CommandDialog.Message.Toggled() }));
    case 'VisibilityToggled':
      return {
        model: {
          ...model,
          shown: !model.shown,
          ...(model.shown
            ? {}
            : {
                menu: CommandMenu.init({ id: 'inline-commands' }),
                palette: CommandDialog.init({ id: 'palette' }),
                embedded: CommandDialog.init({ id: 'embedded-palette' }),
              }),
        },
      };
  }
}
export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  embeddedShortcut: entry(
    { active: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ active: model.shown }),
      dependenciesToStream: ({ active }) =>
        active
          ? CommandDialog.shortcut('mod+k', {
              id: 'embedded-palette',
              inScope: () => !!document.activeElement?.closest('[data-embedded-palette]'),
            }).pipe(
              Stream.map(() => Message.Embedded({ message: CommandDialog.Message.Toggled() })),
            )
          : Stream.empty,
    },
  ),
  paletteShortcut: entry(
    { active: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ active: model.shown }),
      dependenciesToStream: ({ active }) =>
        active
          ? CommandDialog.shortcut('mod+k', { id: 'palette' }).pipe(
              Stream.map(() => Message.Palette({ message: CommandDialog.Message.Toggled() })),
            )
          : Stream.empty,
    },
  ),
}));

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'CommandMenu example',
    body: h.main(
      [],
      [
        h.h1([], ['CommandMenu']),
        h.section(
          [h.DataAttribute('keyboard-scope', '')],
          [h.input([h.AriaLabel('Isolated editor')])],
        ),
        h.section(
          [h.DataAttribute('keyboard-scope', ''), h.DataAttribute('embedded-palette', '')],
          [
            h.input([h.AriaLabel('Scoped editor')]),
            model.shown
              ? h.submodel({
                  slotId: 'embedded',
                  model: model.embedded,
                  view: CommandDialog.view,
                  toParentMessage: (message) => Message.Embedded({ message }),
                  viewInputs: {
                    items,
                    title: 'Embedded palette',
                    placeholder: 'Search embedded commands',
                  },
                })
              : null,
          ],
        ),
        model.shown
          ? h.submodel({
              slotId: 'inline',
              model: model.menu,
              view: CommandMenu.view,
              toParentMessage: (message) => Message.Menu({ message }),
              viewInputs: {
                items,
                placeholder: 'Search inline commands',
                empty: 'No commands',
                footer: true,
              },
            })
          : null,
        model.shown
          ? h.submodel({
              slotId: 'palette',
              model: model.palette,
              view: CommandDialog.view,
              toParentMessage: (message) => Message.Palette({ message }),
              viewInputs: {
                items,
                title: 'Command palette',
                placeholder: 'Search palette',
                empty: 'No commands',
                footer: true,
                filters: () => [
                  h.button(
                    [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
                    ['Remove menus'],
                  ),
                ],
              },
            })
          : null,
        model.shown
          ? h.button([h.Type('button'), h.OnClick(Message.PaletteToggled())], ['Open palette'])
          : null,
        h.p([], [`Selected command: ${model.selected}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide menus' : 'Show menus'],
        ),
      ],
    ),
  };
}
