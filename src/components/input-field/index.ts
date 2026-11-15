import { Input as Primitive } from '@foldkit/ui';
import type { Attribute, Html, HtmlBuilder } from 'foldkit/html';
import { icon } from '../icons';
import './styles.css';

export interface Props<Message> {
  readonly id: string;
  readonly label: string;
  readonly labelHidden?: boolean;
  readonly value: string;
  readonly onInput?: (value: string) => Message;
  readonly placeholder?: string;
  readonly type?: string;
  readonly name?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly error?: string;
  readonly icon?: Html;
  /** The icon set for the error's alert glyph. */
  readonly icons?: string;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly className?: string;
  readonly attributes?: readonly Attribute<Message>[];
}

export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return Primitive.view(
    {
      id: props.id,
      value: props.value,
      onInput: props.onInput,
      placeholder: props.placeholder,
      type: props.type,
      name: props.name,
      isDisabled: props.disabled,
      isReadOnly: props.readOnly,
      isInvalid: !!props.error,
      hasDescription: !!props.error,
      toView: ({ input, label, description }) =>
        h.div(
          [
            h.Class(`ff-input-field ${props.className ?? ''}`),
            h.DataAttribute('input-field', ''),
            ...(props.size ? [h.DataAttribute('size', props.size)] : []),
            ...(props.radius ? [h.DataAttribute('radius', props.radius)] : []),
            ...(props.disabled ? [h.DataAttribute('disabled', '')] : []),
            ...(props.error ? [h.DataAttribute('invalid', '')] : []),
          ],
          [
            h.label(
              [
                ...label,
                h.Class(`ff-input-label ${props.labelHidden ? 'ff-input-label-hidden' : ''}`),
              ],
              [props.label],
            ),
            // A second label makes the icon and empty padding focus the control natively.
            h.label(
              [...label, h.Class('ff-input-surface')],
              [
                props.icon
                  ? h.span([h.Class('ff-input-icon'), h.AriaHidden(true)], [props.icon])
                  : null,
                h.input([...input, h.Class('ff-input-control'), ...(props.attributes ?? [])]),
              ],
            ),
            props.error
              ? h.div(
                  [...description, h.Class('ff-input-error')],
                  [
                    h.span(
                      [h.AriaHidden(true), h.Class('contents')],
                      [icon('circle-alert', props.icons, h)],
                    ),
                    props.error,
                  ],
                )
              : null,
          ],
        ),
    },
    h,
  );
}
