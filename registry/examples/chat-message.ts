import { Schema } from 'effect';
import { type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as ChatMessage from './fluid/components/chat-message';
import * as FileThumbnail from './fluid/components/file-thumbnail';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Bundle the matching worker with this application instead of using a CDN.
FileThumbnail.setPdfWorkerSrc(pdfWorkerSrc);
const image = new File(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#22c55e"/></svg>',
  ],
  'sample.svg',
  { type: 'image/svg+xml' },
);
function samplePdf(): File {
  const stream = '0 0.5 1 rg 0 0 80 80 re f';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 80 80] /Resources << >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let data = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(data.length);
    data += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = data.length;
  data += `xref\n0 5\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => String(offset).padStart(10, '0') + ' 00000 n ')
    .join('\n')}\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new File([data], 'sample.pdf', { type: 'application/pdf' });
}
const files = [image, samplePdf(), new File(['Hello'], 'notes.txt', { type: 'text/plain' })];
export const Model = Schema.Struct({ shown: Schema.Boolean, acknowledged: Schema.Boolean });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({ VisibilityToggled: {}, Acknowledged: {} });
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({ model: { shown: true, acknowledged: false } });
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  return {
    model:
      message._tag === 'VisibilityToggled'
        ? { ...model, shown: !model.shown }
        : { ...model, acknowledged: true },
  };
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'ChatMessage example',
    body: h.main(
      [],
      [
        h.h1([], ['ChatMessage']),
        model.shown
          ? h.div(
              [h.Style({ display: 'flex', flexDirection: 'column', gap: '16px' })],
              [
                ChatMessage.view(
                  {
                    from: 'user',
                    files,
                    time: '10:30',
                    children: ['Please review these files.'],
                    animateEntrance: false,
                    actions: [
                      h.button(
                        [h.Type('button'), h.OnClick(Message.Acknowledged())],
                        ['Acknowledge'],
                      ),
                    ],
                  },
                  h,
                ),
                ChatMessage.view(
                  {
                    from: 'assistant',
                    children: [h.p([], ['I can help with that.'])],
                    animateEntrance: false,
                  },
                  h,
                ),
              ],
            )
          : null,
        h.p([], [model.acknowledged ? 'Acknowledged' : 'Awaiting acknowledgement']),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide transcript' : 'Show transcript'],
        ),
      ],
    ),
  };
}
