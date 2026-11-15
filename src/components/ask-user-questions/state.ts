import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';

/** One question of the flow (upstream's AskUserQuestions `questions`). */
export interface Question {
  readonly id?: string;
  readonly title: string;
  readonly options?: readonly {
    readonly id?: string;
    readonly title: string;
    readonly description?: string;
  }[];
  readonly multiSelect?: boolean;
  readonly allowOther?: boolean;
  readonly otherPlaceholder?: string;
  readonly skippable?: boolean;
  readonly nextLabel?: string;
  readonly layout?: string;
  readonly chipPosition?: string;
  readonly freeText?: boolean;
  readonly freeTextMultiline?: boolean;
  readonly freeTextPlaceholder?: string;
  /** Validate trimmed free text on submit. Return a message to block advancing. */
  readonly freeTextValidate?: (value: string) => string | null | undefined;
}

export const Answer = Schema.Struct({
  questionId: Schema.String,
  selectedIds: Schema.Array(Schema.String),
  otherText: Schema.optionalKey(Schema.String),
  skipped: Schema.optionalKey(Schema.Boolean),
});
export interface Answer extends Schema.Schema.Type<typeof Answer> {}

export const Model = Schema.Struct({
  id: Schema.String,
  step: Schema.Number,
  /** Bumps on every replay, so the runtime re-seats focus and hover. */
  run: Schema.Number,
  /** By question identity, matching upstream questionKey. */
  answers: Schema.Record(Schema.String, Answer),
  error: Schema.String,
  latestAnswers: Schema.Record(Schema.String, Answer),
  renderedAnswers: Schema.Record(Schema.String, Answer),
  visibleIndex: Schema.Number,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export interface InitConfig {
  readonly id: string;
  readonly defaultCurrentIndex?: number;
  readonly defaultAnswers?: Readonly<Record<string, Answer>>;
}
export const init = ({ id, defaultCurrentIndex = 0, defaultAnswers = {} }: InitConfig): Model => ({
  id,
  step: defaultCurrentIndex,
  run: 0,
  answers: defaultAnswers,
  error: '',
  latestAnswers: defaultAnswers,
  renderedAnswers: defaultAnswers,
  visibleIndex: defaultCurrentIndex,
});

export const Message = defineMessageUnion({
  /** An option picked (toggled, for multi-select). */
  Chose: { value: Schema.String },
  TextChanged: { value: Schema.String },
  WentBack: {},
  Skipped: {},
  /** Continue / Finish, ⌘↵, or Enter in a single-line field. */
  Submitted: {},
  Replayed: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  AnswersChanged: { answers: Schema.Record(Schema.String, Answer) },
  CurrentIndexChanged: { index: Schema.Number },
  /** A question was skipped (upstream's onSkip). */
  Skipped: { questionId: Schema.String, index: Schema.Number },
  /** The last question was answered (or skipped): answers by question id. */
  Completed: { answers: Schema.Record(Schema.String, Answer) },
});
export type OutMessage = typeof OutMessage.Type;

export interface Options {
  readonly questions: readonly Question[];
  readonly currentIndex?: number;
  readonly answers?: Readonly<Record<string, Answer>>;
}

export const questionKey = (question: Question, index: number): string =>
  question.id ?? `q-${index}`;
export const optionKey = (
  option: NonNullable<Question['options']>[number],
  index: number,
): string => option.id ?? `o-${index}`;
export const currentStep = (model: Model, questions: readonly Question[]) =>
  Math.max(0, Math.min(model.step, Math.max(0, questions.length - 1)));
export const answerAt = (model: Model, questionId: string): Answer =>
  model.answers[questionId] ?? { questionId, selectedIds: [] };

/** Call on parent control changes, as well as through update. The effective
 * rendered map may differ from both internal answers and the latest write. */
export function sync(model: Model, options: Options): Model {
  const renderedAnswers = options.answers ?? model.answers;
  const visibleIndex = currentStep(
    { ...model, step: options.currentIndex ?? model.step },
    options.questions,
  );
  const latestAnswers =
    renderedAnswers === model.renderedAnswers ? model.latestAnswers : renderedAnswers;
  if (
    renderedAnswers === model.renderedAnswers &&
    visibleIndex === model.visibleIndex &&
    latestAnswers === model.latestAnswers
  )
    return model;
  return {
    ...model,
    renderedAnswers,
    latestAnswers,
    visibleIndex,
    error: visibleIndex === model.visibleIndex ? model.error : '',
  };
}
/** Read-only view projection; the parent syncs its persistent Model when
 * controlled values change. Supply the same controls to view and update. */
export function project(model: Model, options: Options): Model {
  const current = sync(model, options);
  return {
    ...current,
    step: options.currentIndex ?? current.step,
    answers: options.answers ?? current.answers,
  };
}

export function update(
  model: Model,
  message: Message,
  options: Options,
): { readonly model: Model; readonly outMessages: readonly OutMessage[] } {
  model = sync(model, options);
  const { questions } = options;
  const step = model.visibleIndex;
  const question = questions[step];
  if (!question) return { model, outMessages: [] };
  const questionId = questionKey(question, step);
  const rendered = options.answers ?? model.answers;
  const renderedAnswer = rendered[questionId] ?? { questionId, selectedIds: [] };
  const latest = model.latestAnswers[questionId] ?? { questionId, selectedIds: [] };
  const emitted: OutMessage[] = [];
  const stay = (next: Model) => ({ model: next, outMessages: emitted });
  const write = (patch: Partial<Answer>): Model => {
    const answer = { ...latest, ...patch, questionId };
    if (answer.otherText === undefined) delete answer.otherText;
    const answers = { ...model.latestAnswers, [questionId]: answer };
    emitted.push(OutMessage.AnswersChanged({ answers }));
    return {
      ...model,
      latestAnswers: answers,
      answers: options.answers === undefined ? answers : model.answers,
    };
  };
  const setIndex = (next: Model, index: number) => {
    emitted.push(OutMessage.CurrentIndexChanged({ index }));
    return stay(
      options.currentIndex === undefined
        ? { ...next, step: index, visibleIndex: index, error: '' }
        : next,
    );
  };
  const advance = (next: Model, answers = next.latestAnswers) => {
    if (step < questions.length - 1) return setIndex(next, step + 1);
    emitted.push(OutMessage.Completed({ answers }));
    return stay(next);
  };
  switch (message._tag) {
    case 'Replayed':
      return stay(sync({ ...init({ id: model.id }), run: model.run + 1 }, options));
    case 'TextChanged':
      return stay({ ...write({ otherText: message.value, skipped: false }), error: '' });
    case 'WentBack':
      return step > 0 ? setIndex(model, step - 1) : stay(model);
    case 'Skipped': {
      if (question.skippable === false || questions.length <= 1) return stay(model);
      const next = write({ skipped: true });
      emitted.push(OutMessage.Skipped({ questionId, index: step }));
      return advance(next);
    }
    case 'Chose': {
      if (!question.options?.some((option, index) => optionKey(option, index) === message.value))
        return stay(model);
      const selected = new Set(question.multiSelect ? latest.selectedIds : []);
      if (question.multiSelect && selected.has(message.value)) selected.delete(message.value);
      else selected.add(message.value);
      const selectedIds = [...selected];
      const next = write({
        selectedIds,
        ...(!question.multiSelect ? { otherText: latest.otherText || undefined } : {}),
        skipped: false,
      });
      return question.multiSelect ? stay(next) : advance(next);
    }
    case 'Submitted': {
      if (question.multiSelect && !question.freeText) {
        if (!renderedAnswer.selectedIds.length && !(renderedAnswer.otherText ?? '').trim())
          return stay(model);
        return advance(model, rendered);
      }
      const text = (latest.otherText ?? '').trim();
      if (!text) return stay(model);
      const error = question.freeText ? question.freeTextValidate?.(text) : undefined;
      if (error) return stay({ ...model, error });
      return advance({ ...write({ otherText: text, skipped: false }), error: '' });
    }
  }
}
