import { Schema } from 'effect';
import { type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as AskUserQuestions from './fluid/components/ask-user-questions';
const questions: readonly AskUserQuestions.Question[] = [
  {
    id: 'role',
    title: 'Choose a role',
    skippable: false,
    options: [
      { id: 'design', title: 'Designer' },
      { id: 'build', title: 'Builder' },
    ],
  },
  {
    id: 'topics',
    title: 'Choose topics',
    multiSelect: true,
    allowOther: true,
    options: [
      { id: 'ui', title: 'Interfaces' },
      { id: 'data', title: 'Data' },
    ],
  },
  {
    id: 'email',
    title: 'Email address',
    freeText: true,
    freeTextMultiline: false,
    freeTextValidate: (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : 'Enter a valid email address.',
    skippable: false,
  },
];
export const Model = Schema.Struct({
  flow: AskUserQuestions.Model,
  result: Schema.String,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Flow: { message: AskUserQuestions.Message },
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    flow: AskUserQuestions.init({ id: 'onboarding' }),
    result: 'Not completed',
    shown: true,
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  if (message._tag === 'VisibilityToggled') return { model: { ...model, shown: !model.shown } };
  const result = AskUserQuestions.update(model.flow, message.message, { questions });
  const completed = result.outMessages.find((out) => out._tag === 'Completed');
  return {
    model: {
      ...model,
      flow: result.model,
      result: completed ? JSON.stringify(completed.answers) : model.result,
    },
  };
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'AskUserQuestions example',
    body: h.main(
      [],
      [
        h.h1([], ['AskUserQuestions']),
        model.shown
          ? h.submodel({
              slotId: 'onboarding',
              model: model.flow,
              view: AskUserQuestions.view,
              toParentMessage: (message) => Message.Flow({ message }),
              viewInputs: { questions: () => questions },
            })
          : null,
        h.p([h.AriaLabel('Answers')], [model.result]),
        h.button(
          [
            h.Type('button'),
            h.OnClick(Message.Flow({ message: AskUserQuestions.Message.Replayed() })),
          ],
          ['Start again'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide questions' : 'Show questions'],
        ),
      ],
    ),
  };
}
