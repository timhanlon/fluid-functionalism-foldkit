import { Effect, Schema } from 'effect';
import { Command, Render } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as NativeFile from 'foldkit/file';
import { FileDrop } from '@foldkit/ui';
import * as Tooltip from '../tooltip';

/** The AI SDK status values plus the source's legacy idle spelling. */
export const Status = Schema.Literals(['idle', 'streaming', 'submitted', 'ready', 'error']);
export type Status = typeof Status.Type;

/** A message held while the assistant responds: the trimmed text plus the
 * files attached when it was queued, so editing restores both. */
export const QueuedMessage = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  files: Schema.Array(NativeFile.File),
});
export interface QueuedMessage extends Schema.Schema.Type<typeof QueuedMessage> {}

export const Model = Schema.Struct({
  id: Schema.String,
  /** Readline-style recall: the history entry shown, or null while drafting. */
  historyIndex: Schema.NullOr(Schema.Number),
  draftBeforeHistory: Schema.String,
  /** The highlighted suggested prompt; focus stays in the textarea. */
  activeSuggestion: Schema.NullOr(Schema.Number),
  /** Where the last highlight came from: keyboard moves never follow the pointer. */
  suggestionSource: Schema.Literals(['keyboard', 'pointer']),
  drop: FileDrop.Model,
  tooltips: Schema.Record(Schema.String, Tooltip.Model),
  attachmentTooltips: Tooltip.Group.Model,
  /** Politely announces auto-dispatched queue items. */
  live: Schema.String,
  nextQueueId: Schema.Number,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const init = (config: { readonly id: string }): Model => ({
  id: config.id,
  historyIndex: null,
  draftBeforeHistory: '',
  activeSuggestion: null,
  suggestionSource: 'keyboard',
  drop: FileDrop.init({ id: `${config.id}-drop` }),
  tooltips: {},
  attachmentTooltips: Tooltip.Group.init({ id: `${config.id}-attachments` }),
  live: '',
  nextQueueId: 0,
});

export const Message = defineMessageUnion({
  Typed: { value: Schema.String },
  /** A key the view's handler claimed (suggestions, Tab fill, Enter). */
  KeyPressed: { key: Schema.String },
  /** History recall, from the runtime, which alone can see the caret line. */
  HistoryStepped: { step: Schema.Literals([-1, 1]) },
  SendPressed: {},
  StopPressed: {},
  SuggestionHovered: { index: Schema.Number },
  SuggestionPicked: { index: Schema.Number },
  Blurred: {},
  FilesPicked: { files: Schema.Array(NativeFile.File) },
  FileRemoved: { index: Schema.Number },
  QueueEdited: { id: Schema.String },
  QueueRemoved: { id: Schema.String },
  QueueMoved: { id: Schema.String, step: Schema.Literals([-1, 1]) },
  Drop: { message: FileDrop.Message },
  Tip: { key: Schema.String, message: Tooltip.Message },
  AttachmentTip: { message: Tooltip.Group.Message },
  OpenFilePicker: { accept: Schema.NullOr(Schema.String) },
  Completed: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  ValueChanged: { value: Schema.String },
  FilesChanged: { files: Schema.Array(NativeFile.File) },
  /** A submit while idle, or a queued item the consumer released. */
  Sent: {
    value: Schema.String,
    files: Schema.Array(NativeFile.File),
    queuedId: Schema.NullOr(Schema.String),
  },
  QueueChanged: { queue: Schema.Array(QueuedMessage) },
  /** A queued item returns to the composer, replacing the draft. */
  Edited: {
    value: Schema.String,
    files: Schema.Array(NativeFile.File),
    queue: Schema.Array(QueuedMessage),
  },
  Stopped: {},
});
export type OutMessage = typeof OutMessage.Type;

/** Focus the textarea with the caret at the end, after a fill or recall. */
export const FocusField = Command.define('InputMessage.FocusField', {
  args: { id: Schema.String },
  messages: [Message.Completed],
  execute: ({ id }) =>
    Effect.gen(function* () {
      yield* Render.afterCommit;
      const field = document.getElementById(id);
      if (field instanceof HTMLTextAreaElement) {
        field.focus();
        field.setSelectionRange(field.value.length, field.value.length);
      }
      return Message.Completed();
    }),
});
/** Open the native picker, optionally narrowed (e.g. "image/*") just for
 * this invocation, as upstream's openFilePicker(acceptOverride). */
export const ClickFileInput = Command.define('InputMessage.ClickFileInput', {
  args: { id: Schema.String, accept: Schema.NullOr(Schema.String) },
  messages: [Message.Completed],
  execute: ({ id, accept }) =>
    Effect.sync(() => {
      const input = document.getElementById(id);
      if (input instanceof HTMLInputElement) {
        const original = input.accept;
        if (accept) input.accept = accept;
        input.click();
        if (accept) queueMicrotask(() => (input.accept = original));
      }
      return Message.Completed();
    }),
});
