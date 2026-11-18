import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Tooltip from './fluid/components/tooltip';

export const Model = Schema.Struct({
  tooltip: Tooltip.Model,
  shown: Schema.Boolean,
  shortcut: Schema.Boolean,
  group: Tooltip.Group.Model,
  groupShown: Schema.Boolean,
  forced: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Tooltip: { message: Tooltip.Message },
  VisibilityToggled: {},
  ShortcutToggled: {},
  Group: { message: Tooltip.Group.Message },
  GroupToggled: {},
  ForceToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    tooltip: Tooltip.init({ id: 'project-details', showDelay: '100 millis' }),
    shown: true,
    shortcut: true,
    group: Tooltip.Group.init({ id: 'tools', delayDuration: 120 }),
    groupShown: true,
    forced: false,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Group': {
      const result = Tooltip.Group.update(model.group, message.message);
      return {
        model: { ...model, group: result.model },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (message) => Message.Group({ message })),
        ),
      };
    }
    case 'GroupToggled':
      return { model: { ...model, groupShown: !model.groupShown } };
    case 'ForceToggled':
      return { model: { ...model, forced: !model.forced } };
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
    case 'ShortcutToggled':
      return { model: { ...model, shortcut: !model.shortcut } };
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
                shortcut: model.shortcut ? 'Ctrl+K' : undefined,
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
        h.button([h.Type('button'), h.OnClick(Message.ShortcutToggled())], ['Toggle shortcut']),
        h.h2([], ['Grouped tools']),
        model.groupShown
          ? Tooltip.Group.view(
              model.group,
              {
                toMessage: (message) => Message.Group({ message }),
                children: [
                  h.div(
                    [h.Style({ display: 'flex', gap: '12px', marginTop: '60px' })],
                    (
                      [
                        ['one', 'Short', 'First tool', 'bottom'],
                        ['two', 'A much longer action', 'Second tool', 'top'],
                        ['three', 'Third', 'Third tool', 'left'],
                      ] as const
                    ).map(([key, content, label, side]) =>
                      Tooltip.Group.tip(
                        model.group,
                        key,
                        {
                          content,
                          forceOpen: key === 'two' && model.forced ? true : undefined,
                          side,
                          renderTrigger: (attributes) =>
                            h.button([h.Type('button'), ...attributes], [label]),
                        },
                        (message) => Message.Group({ message }),
                        h,
                      ),
                    ),
                  ),
                ],
              },
              h,
            )
          : null,
        h.button(
          [h.Type('button'), h.OnClick(Message.GroupToggled())],
          [model.groupShown ? 'Hide group' : 'Show group'],
        ),
        h.button([h.Type('button'), h.OnClick(Message.ForceToggled())], ['Force second tooltip']),
      ],
    ),
  };
}
