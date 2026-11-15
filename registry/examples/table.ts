import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Table from './fluid/components/table';

export const Model = Schema.Struct({
  ascending: Schema.Boolean,
  rows: Schema.Boolean,
  hover: Schema.Boolean,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Sorted: {},
  RowsToggled: {},
  HoverToggled: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: { ascending: true, rows: true, hover: true, shown: true },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Sorted':
      return { model: { ...model, ascending: !model.ascending } };
    case 'RowsToggled':
      return { model: { ...model, rows: !model.rows } };
    case 'HoverToggled':
      return { model: { ...model, hover: !model.hover } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  const rows = [
    { name: 'Alpha', owner: 'Ada' },
    { name: 'Beta', owner: 'Ben' },
  ].sort((a, b) => (model.ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  return {
    title: 'Table example',
    body: h.main(
      [],
      [
        h.h1([], ['Table']),
        model.shown
          ? Table.view(
              {
                hover: model.hover,
                attributes: [h.AriaLabel('Projects')],
                children: [
                  Table.header(
                    {
                      children: [
                        Table.row(
                          {
                            children: [
                              Table.head(
                                {
                                  attributes: [
                                    h.Scope('col'),
                                    h.Attribute(
                                      'aria-sort',
                                      model.ascending ? 'ascending' : 'descending',
                                    ),
                                  ],
                                  children: [
                                    h.button(
                                      [h.Type('button'), h.OnClick(Message.Sorted())],
                                      ['Sort by name'],
                                    ),
                                  ],
                                },
                                h,
                              ),
                              Table.head({ attributes: [h.Scope('col')], children: ['Owner'] }, h),
                            ],
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  ),
                  Table.body(
                    {
                      children: model.rows
                        ? rows.map((row, index) =>
                            Table.row(
                              {
                                index,
                                attributes: [h.Key(row.name)],
                                children: [
                                  Table.cell({ children: [row.name] }, h),
                                  Table.cell({ children: [row.owner] }, h),
                                ],
                              },
                              h,
                            ),
                          )
                        : [
                            Table.empty(
                              {
                                columns: 2,
                                title: 'No projects',
                                description: 'Add a project to begin.',
                                action: h.button(
                                  [h.Type('button'), h.OnClick(Message.RowsToggled())],
                                  ['Add projects'],
                                ),
                              },
                              h,
                            ),
                          ],
                    },
                    h,
                  ),
                ],
              },
              h,
            )
          : null,
        h.button(
          [h.Type('button'), h.OnClick(Message.RowsToggled())],
          [model.rows ? 'Clear rows' : 'Restore rows'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.HoverToggled())],
          [model.hover ? 'Disable hover' : 'Enable hover'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide table' : 'Show table'],
        ),
      ],
    ),
  };
}
