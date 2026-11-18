import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as NativeFile from 'foldkit/file';
import * as InputMessage from './fluid/components/input-message';
import * as QueuedStack from './fluid/components/queued-stack';
import * as FileThumbnail from './fluid/components/file-thumbnail';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
FileThumbnail.setPdfWorkerSrc(pdfWorkerSrc);
export const Model = Schema.Struct({
  composer: InputMessage.Model,
  stack: QueuedStack.Model,
  value: Schema.String,
  files: Schema.Array(NativeFile.File),
  queue: Schema.Array(InputMessage.QueuedMessage),
  status: InputMessage.Status,
  sent: Schema.String,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Composer: { message: InputMessage.Message },
  Stack: { message: QueuedStack.Message },
  Finished: {},
  StatusChanged: { status: InputMessage.Status },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    composer: InputMessage.init({ id: 'message' }),
    stack: QueuedStack.init({ id: 'pending' }),
    value: '',
    files: [],
    queue: [],
    status: 'idle',
    sent: 'none',
    shown: true,
  },
});
const options = (model: Model): InputMessage.Options => ({
  value: model.value,
  files: model.files,
  queue: model.queue,
  status: model.status,
  maxFiles: 3,
  history: ['Earlier message'],
  suggestions: ['Review this code', 'Explain this change'],
});
function withStatus(model: Model, status: InputMessage.Status): Model {
  const released = InputMessage.releaseOnStatusChange(
    model.composer,
    model.queue,
    model.status,
    status,
  );
  return {
    ...model,
    composer: released.model,
    queue: released.queue,
    status: released.sent ? 'streaming' : status,
    sent: released.sent?.text ?? model.sent,
  };
}
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
    case 'Finished':
      return { model: withStatus(model, 'idle') };
    case 'StatusChanged':
      return { model: withStatus(model, message.status) };
    case 'Stack': {
      const result = QueuedStack.update(model.stack, message.message, model.queue);
      const base = { ...model, stack: result.model };
      const out = result.outMessage;
      if (out?._tag === 'Edit' || out?._tag === 'Remove') {
        const next = update(
          base,
          Message.Composer({
            message:
              out._tag === 'Edit'
                ? InputMessage.Message.QueueEdited({ id: out.item.id })
                : InputMessage.Message.QueueRemoved({ id: out.item.id }),
          }),
        );
        return {
          ...next,
          commands: [
            ...(next.commands ?? []),
            ...(result.commands ?? []).map((command) =>
              Command.mapMessage(command, (message) => Message.Stack({ message })),
            ),
          ],
        };
      }
      return {
        model: out?._tag === 'QueueChanged' ? { ...base, queue: out.queue } : base,
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Stack({ message })),
        ),
      };
    }
    case 'Composer': {
      const result = InputMessage.update(model.composer, message.message, options(model));
      let next: Model = { ...model, composer: result.model };
      const out = result.outMessage;
      switch (out?._tag) {
        case 'ValueChanged':
          next = { ...next, value: out.value };
          break;
        case 'FilesChanged':
          next = { ...next, files: out.files };
          break;
        case 'Sent':
          next = { ...next, value: '', files: [], sent: out.value, status: 'streaming' };
          break;
        case 'QueueChanged':
          next = {
            ...next,
            queue: out.queue,
            ...(message.message._tag === 'SendPressed' || message.message._tag === 'KeyPressed'
              ? { value: '', files: [] }
              : {}),
          };
          break;
        case 'Edited':
          next = { ...next, value: out.value, files: out.files, queue: out.queue };
          break;
        case 'Stopped':
          next = withStatus(next, 'idle');
          break;
      }
      return {
        model: next,
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Composer({ message })),
        ),
      };
    }
  }
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'InputMessage example',
    body: h.main(
      [],
      [
        h.h1([], ['InputMessage']),
        model.shown
          ? h.div(
              [h.Style({ position: 'relative' })],
              [
                h.div(
                  [
                    h.Style({
                      height: model.queue.length
                        ? `${QueuedStack.collapsedHeight(model.queue.length) + 16}px`
                        : '0px',
                      position: 'relative',
                    }),
                  ],
                  [
                    h.submodel({
                      slotId: 'pending',
                      model: model.stack,
                      view: QueuedStack.view,
                      toParentMessage: (message) => Message.Stack({ message }),
                      viewInputs: { queue: model.queue, bottom: 8 },
                    }),
                  ],
                ),
                h.submodel({
                  slotId: 'composer',
                  model: model.composer,
                  view: InputMessage.view,
                  toParentMessage: (message) => Message.Composer({ message }),
                  viewInputs: {
                    ...options(model),
                    showQueue: false,
                    stoppable: true,
                    ariaLabel: 'Message',
                    placeholder: 'Write a message',
                    leftSlot: () => [
                      h.button(
                        [
                          h.Type('button'),
                          h.OnClick(
                            Message.Composer({
                              message: InputMessage.Message.OpenFilePicker({ accept: null }),
                            }),
                          ),
                        ],
                        ['Attach files'],
                      ),
                    ],
                  },
                }),
              ],
            )
          : null,
        h.p(
          [],
          [
            `Last sent: ${model.sent}; status: ${model.status}; queued: ${model.queue.length}; files: ${model.files.length}`,
          ],
        ),
        ...(
          [
            ['submitted', 'Await reply'],
            ['streaming', 'Stream reply'],
            ['error', 'Fail response'],
            ['ready', 'Clear error'],
          ] as const
        ).map(([status, label]) =>
          h.button([h.Type('button'), h.OnClick(Message.StatusChanged({ status }))], [label]),
        ),
        h.button([h.Type('button'), h.OnClick(Message.Finished())], ['Finish response']),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide composer' : 'Show composer'],
        ),
      ],
    ),
  };
}
