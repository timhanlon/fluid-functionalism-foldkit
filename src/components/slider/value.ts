import { Input } from '@foldkit/ui';
import { Option } from 'effect';
import { Submodel } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { Model, Message, range } from './state';
import { SelectDraft } from './edit';
export interface ValueProps {
  readonly value: number;
  readonly label?: string;
  readonly formatValue?: (value: number) => string;
  readonly ariaLabel?: string;
}
export function valueDisplay(model: Model, props: ValueProps, h: HtmlBuilder<Message>): Html {
  const slider = model.slider,
    limits = range(model),
    formatted = props.formatValue?.(props.value) ?? String(props.value);
  return h.span(
    [h.Class('ff-slider-value')],
    [
      h.span(
        [h.Class('ff-slider-value-sizer'), h.AriaHidden(true)],
        [
          `${props.label ? props.label + ': ' : ''}${props.formatValue?.(limits.max) ?? limits.max}`,
        ],
      ),
      h.span(
        [],
        [
          h.span([h.Class('ff-slider-value-label')], [props.label ? `${props.label}: ` : '']),
          model.editing
            ? h.span(
                [h.Class('ff-slider-edit-slot')],
                [
                  Input.view(
                    {
                      id: `${slider.id}-edit`,
                      type: 'number',
                      value: model.draft,
                      onInput: (value) => Message.ChangedDraft({ value }),
                      toView: ({ input }) =>
                        h.input([
                          ...input,
                          h.Class('ff-slider-edit'),
                          h.AriaLabel(props.ariaLabel ?? 'Edit slider value'),
                          h.Min(String(limits.min)),
                          h.Max(String(limits.max)),
                          h.Step(model.steps.length ? 'any' : String(limits.step)),
                          h.OnMount(SelectDraft()),
                          h.OnBlur(Message.CommittedEdit()),
                          h.OnKeyDownPreventDefault((key) =>
                            key === 'Enter'
                              ? Option.some(Message.CommittedEdit())
                              : key === 'Escape'
                                ? Option.some(Message.CancelledEdit())
                                : Option.none(),
                          ),
                        ]),
                    },
                    h,
                  ),
                ],
              )
            : h.span(
                [
                  h.Class('ff-slider-edit-trigger'),
                  h.OnClick(Message.StartedEditing({ value: props.value })),
                ],
                [formatted],
              ),
        ],
      ),
    ],
  );
}
export const valueView = Submodel.defineView<Model, Message, ValueProps>((model, props, h) =>
  valueDisplay(model, props, h),
);
