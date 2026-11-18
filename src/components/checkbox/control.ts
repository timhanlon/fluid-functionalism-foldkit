import { Checkbox as Primitive } from '@foldkit/ui';
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { Mounted } from './control-runtime';
import './control.css';
export interface Props<Message> {
  readonly id: string;
  readonly checked: boolean;
  readonly onToggle: (checked: boolean) => Message;
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly invalid?: boolean;
  readonly required?: boolean;
  readonly ariaLabel?: string;
  readonly name?: string;
  readonly value?: string;
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly size?: 'default' | 'compact';
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
/** A standalone control, composed with Field.label; the existing Checkbox.view
 * remains the full labelled row used by CheckboxGroup. */
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return Primitive.view(
    {
      id: props.id,
      isChecked: props.checked,
      isIndeterminate: props.indeterminate,
      onToggle: props.onToggle,
      isDisabled: props.disabled,
      isReadOnly: props.readOnly,
      toView: ({ checkbox }) => {
        const control = h.button(
          [
            ...checkbox,
            h.Id(props.id),
            h.Class('ff-checkbox-control'),
            h.DataAttribute('slot', 'checkbox'),
            h.DataAttribute('size', props.size ?? 'default'),
            h.DataAttribute('radius', props.radius ?? 'rounded'),
            h.Disabled(!!props.disabled),
            ...(props.disabled ? [h.Tabindex(-1)] : []),
            ...(props.invalid ? [h.AriaInvalid(true)] : []),
            ...(props.ariaLabel ? [h.AriaLabel(props.ariaLabel)] : []),
            h.OnMount(Mounted()),
            ...(props.attributes ?? []),
          ],
          [
            h.svg(
              [
                h.Class('ff-checkbox-control-check'),
                h.ViewBox('0 0 24 24'),
                h.Fill('none'),
                h.Stroke('currentColor'),
                h.StrokeWidth('2'),
                h.StrokeLinecap('round'),
                h.StrokeLinejoin('round'),
                h.AriaHidden(true),
              ],
              [
                h.path(
                  [h.D(props.indeterminate ? 'M7 12H17' : 'M6 12L10 16L18 8'), h.PathLength('1')],
                  [],
                ),
              ],
            ),
          ],
        );
        if (!props.name && !props.required) return control;
        return h.span(
          [h.Class('ff-checkbox-control-root')],
          [
            control,
            h.input([
              h.Type('checkbox'),
              h.Class('ff-checkbox-form-mirror'),
              h.AriaHidden(true),
              h.Tabindex(-1),
              h.Checked(props.checked),
              h.Value(props.value ?? 'on'),
              h.Disabled(!!props.disabled),
              h.Required(!!props.required),
              ...(props.name ? [h.Name(props.name)] : []),
            ]),
          ],
        );
      },
    },
    h,
  );
}
