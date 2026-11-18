import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as ThinkingSteps from './fluid/components/thinking-steps';

export const Model = Schema.Struct({
  open: Schema.NullOr(Schema.Boolean),
  finished: Schema.Boolean,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  OpenChanged: { open: Schema.Boolean },
  Finished: {},
  Restarted: {},
  ChoiceReset: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = () => ({ model: { open: null, finished: false, shown: true } });
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'OpenChanged':
      return { model: { ...model, open: message.open } };
    case 'Finished':
      return { model: { ...model, finished: true } };
    case 'Restarted':
      return { model: { ...model, finished: false } };
    case 'ChoiceReset':
      return { model: { ...model, open: null } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'ThinkingSteps example',
    body: h.main(
      [],
      [
        h.h1([], ['ThinkingSteps']),
        model.shown
          ? ThinkingSteps.view(
              {
                id: 'reasoning',
                open: model.open ?? undefined,
                running: !model.finished,
                meta: model.finished ? ['12s'] : undefined,
                onOpenChange: (open) => Message.OpenChanged({ open }),
                header: ['Reasoning summary'],
                children: [
                  ThinkingSteps.step(
                    {
                      key: 'search',
                      label: 'Search sources',
                      status: 'complete',
                      description: 'Two documents found.',
                      meta: ['0.4s'],
                      href: 'https://example.com/docs',
                    },
                    h,
                  ),
                  ThinkingSteps.step(
                    {
                      key: 'summary',
                      label: 'Summarize findings',
                      status: model.finished ? 'complete' : 'active',
                      description: 'Compare the available evidence.',
                    },
                    h,
                  ),
                  ThinkingSteps.step(
                    {
                      key: 'publish',
                      label: 'Publish answer',
                      status: model.finished ? 'complete' : 'upcoming',
                    },
                    h,
                  ),
                  ThinkingSteps.step(
                    {
                      key: 'failure',
                      icon: 'circle-alert',
                      label: 'Lint failed',
                      status: 'error',
                      isLast: true,
                    },
                    h,
                  ),
                  ThinkingSteps.step(
                    { key: 'pending', label: 'Not dispatched', status: 'pending' },
                    h,
                  ),
                ],
              },
              h,
            )
          : null,
        h.button([h.Type('button'), h.OnClick(Message.Finished())], ['Complete reasoning']),
        h.button([h.Type('button'), h.OnClick(Message.Restarted())], ['Restart reasoning']),
        h.button([h.Type('button'), h.OnClick(Message.ChoiceReset())], ['Follow running state']),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide steps' : 'Show steps'],
        ),
      ],
    ),
  };
}
