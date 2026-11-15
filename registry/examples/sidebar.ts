import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Sidebar from './fluid/components/sidebar';

export const Model = Schema.Struct({
  sidebar: Sidebar.Model,
  page: Schema.String,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Sidebar: { message: Sidebar.Message },
  Selected: { value: Schema.String },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    sidebar: Sidebar.init({ id: 'workspace-nav', width: '208px' }),
    page: 'Inbox',
    shown: true,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Sidebar': {
      const result = Sidebar.update(model.sidebar, message.message);
      return {
        model: { ...model, sidebar: result.model },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Sidebar({ message })),
        ),
      };
    }
    case 'Selected':
      return {
        model: { ...model, page: message.value, sidebar: { ...model.sidebar, openMobile: false } },
      };
    case 'VisibilityToggled':
      return {
        model: {
          ...model,
          shown: !model.shown,
          sidebar: Sidebar.init({
            id: 'workspace-nav',
            width: model.sidebar.width,
            defaultOpen: model.sidebar.open,
          }),
        },
      };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  const kit: Sidebar.Kit<Message> = {
    h,
    toMessage: (message) => Message.Sidebar({ message }),
    radius: 'rounded',
  };
  return {
    title: 'Sidebar example',
    body: h.div(
      [],
      [
        h.h1([], ['Sidebar']),
        model.shown
          ? Sidebar.provider(
              model.sidebar,
              { peek: 'none', attributes: [h.Style({ height: '360px', minHeight: '0' })] },
              [
                ...Sidebar.sidebar(
                  model.sidebar,
                  { height: 'h-full', peek: 'none' },
                  [
                    Sidebar.header(
                      [
                        h.div(
                          [h.Style({ display: 'flex', alignItems: 'center', gap: '8px' })],
                          [Sidebar.Blocks.workspaceTile('F', kit), h.strong([], ['Workspace'])],
                        ),
                      ],
                      kit,
                    ),
                    Sidebar.content(
                      model.sidebar,
                      [
                        Sidebar.group(
                          model.sidebar,
                          { key: 'pages', label: 'Pages', collapsible: true },
                          [
                            Sidebar.menu(
                              ['Inbox', 'Reports'].map((value) => ({
                                key: value,
                                label: value,
                                active: model.page === value,
                                onClick: Message.Selected({ value }),
                              })),
                              { model: model.sidebar, label: 'Workspace pages' },
                              kit,
                            ),
                          ],
                          kit,
                        ),
                      ],
                      kit,
                    ),
                    Sidebar.footer([h.small([], ['Personal workspace'])], kit),
                  ],
                  kit,
                ),
                Sidebar.inset(
                  [
                    Sidebar.trigger(model.sidebar, {}, kit),
                    h.h2([], [model.page]),
                    h.p([], ['Your application content.']),
                  ],
                  kit,
                ),
              ],
              kit,
            )
          : null,
        h.p(
          [],
          [
            `Section: ${model.page}; open: ${model.sidebar.open}; mobile: ${model.sidebar.isMobile}`,
          ],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide workspace' : 'Show workspace'],
        ),
      ],
    ),
  };
}
