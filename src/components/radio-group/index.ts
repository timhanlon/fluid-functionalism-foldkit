import { RadioGroup as Primitive } from '@foldkit/ui';
import { Option } from 'effect';
import { Submodel } from 'foldkit';
import { Mounted } from './runtime';
import './styles.css';

const behavior = Primitive.create();
export const Model = Primitive.Model;
export type Model = Primitive.Model;
export const Message = Primitive.Message;
export type Message = Primitive.Message;
export const init = Primitive.init;
export const update = behavior.update;
export type OutMessage = Primitive.OutMessage;
export interface Item {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}
export interface Props {
  readonly items: readonly Item[];
  readonly value?: string;
  readonly label: string;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly disabled?: boolean;
  readonly name?: string;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) =>
  h.submodel({
    slotId: 'behavior',
    model,
    view: behavior.view,
    toParentMessage: (message) => message,
    viewInputs: {
      options: props.items.map((item) => item.value),
      selectedValue: Option.fromUndefinedOr(props.value),
      ariaLabel: props.label,
      orientation: 'Vertical',
      name: props.name,
      isDisabled: props.disabled,
      isOptionDisabled: (_, index) => !!props.items[index]?.disabled,
      toView: ({ group, options, hiddenInput }) =>
        h.div(
          [
            ...group,
            h.Class('ff-radio-group'),
            h.DataAttribute('size', props.size ?? 'default'),
            h.DataAttribute('radius', props.radius ?? 'rounded'),
            h.OnMount(Mounted()),
          ],
          [
            ...options.map((option) =>
              h.button(
                [...option.option, h.Class('ff-radio'), h.Disabled(option.isDisabled)],
                [
                  h.span(
                    [h.Class('ff-radio-glyph'), h.AriaHidden(true)],
                    [
                      h.span([h.Class('ff-radio-border')], []),
                      h.span([h.Class('ff-radio-dot')], []),
                    ],
                  ),
                  h.span(
                    [...option.label, h.Class('ff-radio-label')],
                    [
                      h.span(
                        [h.Class('ff-radio-sizer'), h.AriaHidden(true)],
                        [props.items[option.index]?.label ?? option.value],
                      ),
                      h.span(
                        [h.Class('ff-radio-text')],
                        [props.items[option.index]?.label ?? option.value],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            props.name ? h.input(hiddenInput) : null,
          ],
        ),
    },
  }),
);
