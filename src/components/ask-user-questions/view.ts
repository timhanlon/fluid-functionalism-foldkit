import { Submodel } from 'foldkit';
import type { ChildAttribute } from 'foldkit/html';
import { cn } from '../../lib/utils';
import { icon } from '../icons';
import * as Button from '../button';
import * as KeyCap from '../key-cap';
import { Runtime } from './runtime';
import {
  answerAt,
  currentStep,
  questionKey,
  optionKey,
  project,
  type Answer,
  Message,
  type Model,
  type Question,
} from './state';

export interface Props {
  /** Use a top-level getter when questions include validation callbacks. */
  readonly questions: readonly Question[] | (() => readonly Question[]);
  /** Pass matching controls to update; call sync when the parent changes them. */
  readonly currentIndex?: number;
  readonly answers?: Readonly<Record<string, Answer>>;
  readonly skipLabel?: string;
  readonly attributes?: readonly ChildAttribute[];
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly className?: string;
  readonly icons?: string;
}

/** AskUserQuestions: one question at a time in a card that morphs between
 * heights — numbered option rows (or a free-text field), an optional
 * "something else" field, and Back / Skip / Continue in the footer. */
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const questions = typeof props.questions === 'function' ? props.questions() : props.questions;
  model = project(model, { questions, currentIndex: props.currentIndex, answers: props.answers });
  const step = currentStep(model, questions);
  const q = questions[step];
  if (!q) return h.div([], []);
  const questionId = questionKey(q, step);
  const answer = answerAt(model, questionId);
  const selected = answer.selectedIds;
  const text = answer.otherText ?? '';
  const error = model.error;
  const key = model.id;
  const compact = props.size === 'compact';
  const pill = props.radius === 'pill';
  const arrow = (left = false) =>
    icon(left ? 'arrow-left' : 'arrow-right', props.icons, h, {
      attributes: [
        h.Attribute('width', '14'),
        h.Attribute('height', '14'),
        h.Attribute('stroke-width', '2'),
      ],
    });
  const field = (free: boolean) =>
    h.textarea([
      h.Key(`${questionId}-field`),
      h.Class('auq-textarea'),
      h.Attribute('rows', '1'),
      h.DataAttribute('auq-field', free ? 'free' : 'other'),
      h.DataAttribute('multiline', String(!free || q.freeTextMultiline !== false)),
      h.AriaLabel(free ? q.title : (q.otherPlaceholder ?? 'Describe in your own words')),
      h.Placeholder(
        free
          ? (q.freeTextPlaceholder ?? 'Type your answer…')
          : (q.otherPlaceholder ?? 'Describe in your own words…'),
      ),
      h.Value(text),
      h.Attribute('aria-invalid', String(!!error)),
      ...(error ? [h.Attribute('aria-describedby', `${key}-error`)] : []),
      h.OnInput((value) => Message.TextChanged({ value })),
    ]);
  const showBack = step > 0 && questions.length > 1;
  const showSkip = questions.length > 1 && q.skippable !== false;
  const showSubmit = q.multiSelect || q.freeText;
  const showFooter = showBack || showSkip || showSubmit;
  const footerButton = (
    name: 'back' | 'skip' | 'submit',
    label: string,
    primary = false,
    disabled = false,
  ) =>
    Button.view(
      {
        variant: primary ? 'primary' : 'ghost',
        size: 'compact',
        radius: props.radius ?? 'rounded',
        disabled,
        onClick:
          name === 'back'
            ? Message.WentBack()
            : name === 'skip'
              ? Message.Skipped()
              : Message.Submitted(),
        attributes: [h.DataAttribute('auq-action', name)],
        leadingIcon: name === 'back' ? arrow(true) : undefined,
        // Skip's → hints at the ArrowRight key (desktop only, as upstream).
        trailingIcon: name === 'skip' ? h.span([h.Class('auq-skip-arrow')], [arrow()]) : undefined,
        children: primary
          ? [
              h.span(
                [h.Class('auq-submit-label')],
                [
                  label,
                  h.span(
                    [h.Class('auq-submit-shortcut ff-key-caps'), h.AriaHidden(true)],
                    [
                      KeyCap.view(
                        {
                          children: ['⌃'],
                          tone: 'inverted',
                          attributes: [h.DataAttribute('auq-modifier', '')],
                        },
                        h,
                      ),
                      KeyCap.view({ children: ['↵'], tone: 'inverted' }, h),
                    ],
                  ),
                ],
              ),
            ]
          : [label],
      },
      h,
    );
  const title = (label: string, active: boolean) =>
    h.span(
      [h.Class('auq-option-label')],
      [
        h.span(
          [
            h.Class('col-start-1 row-start-1 invisible'),
            h.AriaHidden(true),
            h.Attribute('style', "font-variation-settings:'wght' 550,'opsz' 18"),
          ],
          [label],
        ),
        h.span(
          [
            h.Class('col-start-1 row-start-1 auq-option-title'),
            h.Attribute(
              'style',
              `font-variation-settings:'wght' ${active ? 550 : 400},'opsz' ${active ? 18 : 14}`,
            ),
          ],
          [label],
        ),
      ],
    );
  return h.div(
    [
      h.Key(key),
      h.Class(
        cn(
          'auq-flow relative w-full max-w-[520px] overflow-hidden bg-card border border-border rounded-xl',
          props.className,
        ),
      ),
      h.DataAttribute('size', compact ? 'compact' : 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('auq-step', JSON.stringify([questionId, step, model.run, !!q.freeText])),
      h.DataAttribute('auq-multi', String(!!q.multiSelect)),
      h.OnMount(Runtime()),
      ...(props.attributes ?? []),
    ],
    [
      h.div(
        [h.Class(`auq-header ${compact ? 'auq-compact' : ''}`)],
        // Separate text runs, as upstream's JSX renders them: each run shapes
        // on its own, which sets the digits' kerning.
        [h.span([], ['Question ', String(step + 1), ' of ', String(questions.length)])],
      ),
      h.div(
        [h.Class('auq-morph'), h.DataAttribute('auq-morph', '')],
        [
          h.div(
            [
              h.DataAttribute('auq-body', ''),
              h.Class(`auq-body ${showFooter ? 'auq-with-footer' : ''}`),
            ],
            [
              h.div(
                [h.Key(questionId), h.Class('flex flex-col gap-2')],
                [
                  h.h3(
                    [
                      h.Class('auq-title text-foreground'),
                      h.Attribute('style', "font-variation-settings:'wght' 550,'opsz' 18"),
                    ],
                    [q.title],
                  ),
                  q.freeText
                    ? h.div(
                        [
                          h.Class(
                            `auq-free-field ${q.freeTextMultiline === false ? 'auq-single-line' : ''}`,
                          ),
                          h.DataAttribute('filled', String(!!text)),
                        ],
                        [field(true)],
                      )
                    : h.div(
                        [
                          h.Key(questionId + '-rows'),
                          h.Class('auq-options relative flex flex-col -mx-3'),
                          h.Role(q.multiSelect ? 'group' : 'radiogroup'),
                          h.AriaLabel(q.title),
                        ],
                        [
                          ...(q.options ?? []).map((option, i) => {
                            const optionId = optionKey(option, i);
                            const checked = selected.includes(optionId);
                            const nextOption = (q.options ?? [])[i + 1];
                            const joinsNext =
                              checked &&
                              !!nextOption &&
                              selected.includes(optionKey(nextOption, i + 1));
                            const chip = h.span(
                              [h.Class('auq-chip-slot'), h.AriaHidden(true)],
                              [
                                h.span(
                                  [h.Class(`auq-chip ${q.multiSelect ? 'auq-checkbox' : ''}`)],
                                  [String(i + 1)],
                                ),
                                !q.multiSelect && q.chipPosition !== 'left'
                                  ? h.span([h.Class('auq-arrow')], [arrow()])
                                  : null,
                              ],
                            );
                            return h.div(
                              [
                                h.Key(optionId),
                                h.Role(q.multiSelect ? 'checkbox' : 'radio'),
                                h.AriaChecked(checked),
                                h.Tabindex(
                                  i ===
                                    Math.max(
                                      0,
                                      (q.options ?? []).findIndex((o, index) =>
                                        selected.includes(optionKey(o, index)),
                                      ),
                                    )
                                    ? 0
                                    : -1,
                                ),
                                h.Class(
                                  `auq-option ${q.layout === 'stacked' ? 'auq-stacked' : ''} ${q.chipPosition === 'left' ? 'auq-chip-left' : ''}`,
                                ),
                                h.DataAttribute('auq-option', optionId),
                                ...(joinsNext ? [h.DataAttribute('joins-next', '')] : []),
                                h.OnClick(Message.Chose({ value: optionId })),
                              ],
                              [
                                q.chipPosition === 'left' ? chip : null,
                                h.span(
                                  [h.Class('auq-option-body')],
                                  [
                                    title(option.title, checked),
                                    option.description
                                      ? h.span(
                                          [h.Class('auq-description text-muted-foreground')],
                                          [
                                            q.layout === 'stacked'
                                              ? option.description
                                              : ' ' + option.description,
                                          ],
                                        )
                                      : null,
                                  ],
                                ),
                                q.chipPosition !== 'left'
                                  ? chip
                                  : !q.multiSelect
                                    ? h.span(
                                        [h.Class('auq-chip-slot'), h.AriaHidden(true)],
                                        [h.span([h.Class('auq-arrow')], [arrow()])],
                                      )
                                    : null,
                              ],
                            );
                          }),
                          q.allowOther
                            ? h.div(
                                [h.Class('auq-other'), h.DataAttribute('filled', String(!!text))],
                                [
                                  field(false),
                                  // The row's own number chip, as the option
                                  // rows; single-select swaps it for the
                                  // submit arrow once there is text.
                                  q.multiSelect || !text.trim()
                                    ? h.span(
                                        [h.Class('auq-chip-slot'), h.AriaHidden(true)],
                                        [
                                          h.span(
                                            [
                                              h.Class(
                                                `auq-chip ${q.multiSelect ? 'auq-checkbox' : ''}`,
                                              ),
                                            ],
                                            [String((q.options?.length ?? 0) + 1)],
                                          ),
                                        ],
                                      )
                                    : null,
                                  !q.multiSelect && text.trim()
                                    ? h.button(
                                        [
                                          h.Type('button'),
                                          h.AriaLabel('Submit other answer'),
                                          h.Class('auq-other-submit'),
                                          h.OnClick(Message.Submitted()),
                                        ],
                                        [arrow()],
                                      )
                                    : null,
                                ],
                              )
                            : null,
                        ],
                      ),
                ],
              ),
            ],
          ),
        ],
      ),
      showFooter
        ? h.div(
            [h.Class('auq-footer')],
            [
              h.div(
                [h.Class('auq-footer-left')],
                [
                  showBack ? footerButton('back', 'Back') : null,
                  error
                    ? h.span(
                        [
                          h.Id(`${key}-error`),
                          h.Role('alert'),
                          h.Class('auq-error text-destructive'),
                        ],
                        [error],
                      )
                    : null,
                ],
              ),
              h.div(
                [h.Class('flex items-center gap-2')],
                [
                  showSkip ? footerButton('skip', props.skipLabel ?? 'Skip') : null,
                  showSubmit
                    ? footerButton(
                        'submit',
                        q.nextLabel ?? (step === questions.length - 1 ? 'Finish' : 'Continue'),
                        true,
                        !text.trim() && (!selected.length || !!q.freeText),
                      )
                    : null,
                ],
              ),
            ],
          )
        : null,
    ],
  );
});
