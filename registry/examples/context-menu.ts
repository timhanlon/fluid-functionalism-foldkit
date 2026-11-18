import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as ContextMenu from './fluid/components/context-menu';
import * as Button from './fluid/components/button';
import * as Input from './fluid/components/input';
const items: readonly ContextMenu.Item[] = [
  { value: 'Rename', label: 'Rename', shortcut: 'F2' },
  { value: 'Duplicate', label: 'Duplicate' },
  { value: 'Delete', label: 'Delete', destructive: true, shortcut: '⌘⌫' },
  { value: 'Unavailable', label: 'Unavailable', disabled: true },
  {
    value: 'Share',
    label: 'Share',
    group: 'share',
    groupLabel: '',
    children: [
      { value: 'Copy link', label: 'Copy link' },
      { value: 'Email', label: 'Email' },
    ],
  },
];
export const Model = Schema.Struct({
  context: ContextMenu.Model,
  last: Schema.String,
  leading: Schema.Number,
  shown: Schema.Boolean,
  search: Schema.Boolean,
  compact: Schema.Boolean,
  draft: Schema.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Context: { message: ContextMenu.Message },
  LeadingClicked: {},
  VisibilityToggled: {},
  SearchToggled: {},
  SizeToggled: {},
  DraftChanged: { value: Schema.String },
  Noop: {},
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: {
    context: ContextMenu.init({ id: 'files-context' }),
    last: '',
    leading: 0,
    shown: true,
    search: false,
    compact: false,
    draft: 'Notes',
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  if (message._tag === 'LeadingClicked') return { model: { ...model, leading: model.leading + 1 } };
  if (message._tag === 'VisibilityToggled') return { model: { ...model, shown: !model.shown } };
  if (message._tag === 'SizeToggled') return { model: { ...model, compact: !model.compact } };
  if (message._tag === 'SearchToggled') return { model: { ...model, search: !model.search } };
  if (message._tag === 'DraftChanged') return { model: { ...model, draft: message.value } };
  if (message._tag === 'Noop') return { model };
  const result = ContextMenu.update(model.context, message.message, {
    items,
    search: model.search,
  });
  let last = model.last;
  for (const out of result.outMessages ?? [])
    if (out._tag === 'Selected') last = `${out.value} ${out.targetValue ?? ''}`.trim();
  return {
    model: { ...model, context: result.model, last },
    commands: result.commands?.map((command) =>
      Command.mapMessage(command, (message) => Message.Context({ message })),
    ),
  };
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'ContextMenu example',
    body: h.main(
      [h.Style({ display: 'grid', gap: '12px' })],
      [
        h.h1([], ['ContextMenu']),
        h.p([], [`Context leading actions: ${model.leading}`]),
        Button.view(
          { children: ['Focus anchor'], onClick: Message.Noop(), variant: 'secondary' },
          h,
        ),
        model.shown
          ? h.submodel({
              slotId: 'files',
              model: model.context,
              view: ContextMenu.view,
              toParentMessage: (message) => Message.Context({ message }),
              viewInputs: {
                label: 'File actions',
                items,
                renderLeading: (item) =>
                  item.value === 'Rename'
                    ? h.button(
                        [
                          h.Type('button'),
                          h.AriaLabel('Inspect context target'),
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
                      )
                    : null,
                menuWidth: 224,
                radius: 'sharp',
                size: model.compact ? 'compact' : 'default',
                search: model.search,
                placeholder: 'Find action',
                triggers: [{ id: 'files-area' }, { id: 'disabled-area', disabled: true }],
                filter: (target) => !!target.closest('[data-file]'),
                renderTrigger: (id, attributes, opened) =>
                  id === 'disabled-area'
                    ? h.div(
                        [
                          ...attributes,
                          h.Tabindex(0),
                          h.DataAttribute('file', 'disabled'),
                          h.Style({ padding: '12px' }),
                        ],
                        ['Disabled area'],
                      )
                    : h.div(
                        [
                          ...attributes,
                          h.Role('group'),
                          h.AriaLabel('Files'),
                          h.Tabindex(0),
                          h.Style({ border: '1px solid var(--border)', padding: '12px' }),
                        ],
                        [
                          ...['Q3 report.pdf', 'Roadmap.fig', 'Notes.md'].map((name) =>
                            h.div(
                              [
                                h.Tabindex(0),
                                h.DataAttribute('file', name),
                                h.DataAttribute('context-value', name),
                                h.Style({
                                  padding: '8px',
                                  ...(opened && model.context.targetValue === name
                                    ? { background: 'var(--hover)' }
                                    : {}),
                                }),
                              ],
                              [name],
                            ),
                          ),
                          Input.view(
                            {
                              id: 'context-file-name',
                              value: model.draft,
                              onInput: (value) => Message.DraftChanged({ value }),
                              ariaLabel: 'File name',
                            },
                            h,
                          ),
                        ],
                      ),
              },
            })
          : null,
        h.p(
          [h.Attribute('aria-live', 'polite')],
          [model.last ? `Last action: ${model.last}` : 'No action yet'],
        ),
        Button.view(
          {
            children: [model.search ? 'Disable search' : 'Enable search'],
            variant: 'ghost',
            onClick: Message.SearchToggled(),
          },
          h,
        ),
        Button.view(
          {
            children: [model.compact ? 'Default size' : 'Compact size'],
            variant: 'ghost',
            onClick: Message.SizeToggled(),
          },
          h,
        ),
        Button.view(
          {
            children: [model.shown ? 'Hide files' : 'Show files'],
            variant: 'ghost',
            onClick: Message.VisibilityToggled(),
          },
          h,
        ),
      ],
    ),
  };
}
