import { Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as CodeBlock from './fluid/components/code-block';
export const SOURCE = `export function Greeting({ name }: { name: string }) {
  return <p>Hello, {name}.</p>;
}\n`;
const OUTPUT = Array.from({ length: 20 }, (_, i) => `Step ${i + 1}: built successfully`).join('\n');
export const Model = Schema.Struct({
  code: CodeBlock.Model,
  output: CodeBlock.Model,
  copied: Schema.Number,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Block: { key: Schema.Literals(['code', 'output']), message: CodeBlock.Message },
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: {
    code: CodeBlock.init({ id: 'example-code' }),
    output: CodeBlock.init({ id: 'example-output' }),
    copied: 0,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  const result = CodeBlock.update(model[message.key], message.message, {
    code: message.key === 'code' ? SOURCE : OUTPUT,
  });
  return {
    model: {
      ...model,
      [message.key]: result.model,
      copied: model.copied + (result.outMessage?._tag === 'Copied' ? 1 : 0),
    },
    commands: result.commands?.map((command) =>
      Command.mapMessage(command, (child) => Message.Block({ key: message.key, message: child })),
    ),
  };
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'CodeBlock example',
    body: h.main(
      [h.Style({ display: 'grid', gap: '16px' })],
      [
        h.h1([], ['CodeBlock']),
        h.submodel({
          slotId: 'code',
          model: model.code,
          view: CodeBlock.view,
          toParentMessage: (message) => Message.Block({ key: 'code', message }),
          viewInputs: { code: SOURCE, title: 'greeting.tsx', lineNumbers: true, radius: 'sharp' },
        }),
        h.submodel({
          slotId: 'output',
          model: model.output,
          view: CodeBlock.view,
          toParentMessage: (message) => Message.Block({ key: 'output', message }),
          viewInputs: {
            code: OUTPUT,
            wrap: true,
            maxHeight: 80,
            hideHeader: true,
            radius: 'sharp',
          },
        }),
        h.p([], [`Successful copies: ${model.copied}`]),
      ],
    ),
  };
}
