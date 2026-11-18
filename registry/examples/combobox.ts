import { Effect, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Combobox from './fluid/components/combobox';

const items = [
  { value: 'foldkit', label: 'Foldkit' },
  { value: 'elm', label: 'Elm' },
  { value: 'svelte', label: 'Svelte' },
];
const RemoteItem = Schema.Struct({ value: Schema.String, label: Schema.String });
const initialRemoteValues = ['remote-z', 'foldkit', 'remote-a'];
const remoteItems = (loaded: boolean, created: readonly (typeof RemoteItem.Type)[]) => [
  ...(loaded
    ? [
        { value: 'remote-a', label: 'Remote Alpha' },
        ...[...items].reverse(),
        { value: 'remote-z', label: 'Remote Zed' },
      ]
    : items),
  ...created,
];
export const Model = Schema.Struct({
  combo: Combobox.Model,
  value: Schema.String,
  multi: Combobox.Multi.Model,
  values: Schema.Array(Schema.String),
  remote: Combobox.Multi.Model,
  remoteValues: Schema.Array(Schema.String),
  remoteState: Schema.Literals(['idle', 'loading', 'loaded']),
  pendingCreate: Schema.String,
  created: Schema.Array(RemoteItem),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Combo: { message: Combobox.Message },
  Multi: { message: Combobox.Multi.Message },
  Remote: { message: Combobox.Multi.Message },
  RemoteLoadRequested: {},
  RemoteLoaded: {},
  RemoteUnloaded: {},
  CreationFinished: {},
  RemoteReset: {},
  FormSubmitted: {},
});
export type Message = typeof Message.Type;
const LoadRemote = Command.define('Example.LoadRemoteLabels', {
  messages: [Message.RemoteLoaded],
  execute: Effect.sleep('1 second').pipe(Effect.as(Message.RemoteLoaded())),
});
export const init = () => ({
  model: {
    combo: Combobox.init({ id: 'example-framework' }),
    value: 'foldkit',
    multi: Combobox.Multi.init({ id: 'example-tags' }),
    values: ['foldkit'],
    remote: Combobox.Multi.init({ id: 'example-remote-frameworks' }),
    remoteValues: initialRemoteValues,
    remoteState: 'idle' as const,
    pendingCreate: '',
    created: [],
  },
});

export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'FormSubmitted':
      return { model };
    case 'RemoteLoadRequested':
      return model.remoteState === 'loading'
        ? { model }
        : { model: { ...model, remoteState: 'loading' }, commands: [LoadRemote()] };
    case 'RemoteLoaded':
      return { model: { ...model, remoteState: 'loaded' } };
    case 'RemoteUnloaded':
      return model.remoteState === 'loading'
        ? { model }
        : { model: { ...model, remoteState: 'idle' } };
    case 'RemoteReset':
      return {
        model: {
          ...model,
          remoteValues: initialRemoteValues,
          pendingCreate: '',
          created: [],
        },
      };
    case 'CreationFinished': {
      if (!model.pendingCreate) return { model };
      const item = { value: `created-${model.created.length}`, label: model.pendingCreate };
      return {
        model: {
          ...model,
          created: [...model.created, item],
          remoteValues: [...model.remoteValues, item.value],
          pendingCreate: '',
        },
      };
    }
    case 'Remote': {
      const result = Combobox.Multi.update(
        model.remote,
        message.message,
        remoteItems(model.remoteState === 'loaded', model.created),
        model.remoteValues,
        { creatable: true },
      );
      return {
        model: {
          ...model,
          remote: result.model,
          remoteValues:
            result.outMessage?._tag === 'Changed' ? result.outMessage.values : model.remoteValues,
          pendingCreate:
            result.outMessage?._tag === 'Created' ? result.outMessage.query : model.pendingCreate,
        },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (message) => Message.Remote({ message })),
        ),
      };
    }
    case 'Combo': {
      const result = Combobox.update(model.combo, message.message, items, { value: model.value });
      return {
        model: {
          ...model,
          combo: result.model,
          value: result.outMessage?._tag === 'Selected' ? result.outMessage.value : model.value,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Combo({ message })),
        ),
      };
    }
    case 'Multi': {
      const result = Combobox.Multi.update(model.multi, message.message, items, model.values);
      return {
        model: {
          ...model,
          multi: result.model,
          values: result.outMessage?._tag === 'Changed' ? result.outMessage.values : model.values,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Multi({ message })),
        ),
      };
    }
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Combobox example',
    body: h.main(
      [],
      [
        h.h1([], ['Combobox']),
        h.submodel({
          slotId: 'framework',
          model: model.combo,
          view: Combobox.view,
          toParentMessage: (message) => Message.Combo({ message }),
          viewInputs: { label: 'Framework', items, value: model.value },
        }),
        h.p([h.Attribute('aria-live', 'polite')], [`Selected framework: ${model.value}`]),
        h.submodel({
          slotId: 'tags',
          model: model.multi,
          view: Combobox.Multi.view,
          toParentMessage: (message) => Message.Multi({ message }),
          viewInputs: { label: 'Tags', items, values: model.values },
        }),
        h.p([h.Attribute('aria-live', 'polite')], [`Selected tags: ${model.values.join(',')}`]),
        h.form(
          [h.Id('remote-form'), h.OnSubmit(Message.FormSubmitted())],
          [
            h.submodel({
              slotId: 'remote',
              model: model.remote,
              view: Combobox.Multi.view,
              toParentMessage: (message) => Message.Remote({ message }),
              viewInputs: {
                label: 'Remote frameworks',
                clearable: true,
                name: 'remote-frameworks',
                items: remoteItems(model.remoteState === 'loaded', model.created),
                values: model.remoteValues,
                creatable: true,
              },
            }),
          ],
        ),
        h.p(
          [h.Attribute('aria-live', 'polite')],
          [`Remote selections: ${model.remoteValues.join(',')}`],
        ),
        h.p([], [`Remote data: ${model.remoteState}`]),
        h.button(
          [
            h.Type('button'),
            h.Disabled(model.remoteState === 'loading'),
            h.OnClick(Message.RemoteLoadRequested()),
          ],
          ['Load remote labels'],
        ),
        h.button(
          [
            h.Type('button'),
            h.Disabled(model.remoteState === 'loading'),
            h.OnClick(Message.RemoteUnloaded()),
          ],
          ['Unload remote labels'],
        ),
        h.button([h.Type('button'), h.OnClick(Message.RemoteReset())], ['Reset remote selection']),
        model.pendingCreate
          ? h.button(
              [h.Type('button'), h.OnClick(Message.CreationFinished())],
              [`Finish creating ${model.pendingCreate}`],
            )
          : null,
      ],
    ),
  };
}
