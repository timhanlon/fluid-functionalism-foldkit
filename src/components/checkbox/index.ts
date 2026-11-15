import { Checkbox as Primitive } from '@foldkit/ui';
import type { Html, HtmlBuilder } from 'foldkit/html';
import './styles.css';

export interface Props<Message> {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onToggle: (checked: boolean) => Message;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly name?: string;
  readonly value?: string;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return Primitive.view(
    {
      id: props.id,
      isChecked: props.checked,
      onToggle: props.onToggle,
      isDisabled: props.disabled,
      isReadOnly: props.readOnly,
      name: props.name,
      value: props.value,
      toView: ({ checkbox, hiddenInput }) =>
        h.div(
          [h.Class('ff-checkbox-item')],
          [
            h.button(
              [
                ...checkbox,
                h.Id(props.id),
                h.Disabled(!!props.disabled),
                h.Class('ff-checkbox'),
                ...(props.size ? [h.DataAttribute('size', props.size)] : []),
                ...(props.radius ? [h.DataAttribute('radius', props.radius)] : []),
              ],
              [
                h.span(
                  [h.Class('ff-checkbox-glyph'), h.AriaHidden(true)],
                  [
                    h.span([h.Class('ff-checkbox-border')], []),
                    h.svg(
                      [
                        h.Class('ff-checkbox-check'),
                        h.ViewBox('0 0 24 24'),
                        h.Fill('none'),
                        h.Stroke('currentColor'),
                        h.StrokeWidth('2'),
                        h.StrokeLinecap('round'),
                        h.StrokeLinejoin('round'),
                      ],
                      [h.path([h.D('M6 12L10 16L18 8'), h.PathLength('1')], [])],
                    ),
                  ],
                ),
                h.span(
                  [h.Id(Primitive.labelId(props.id)), h.Class('ff-checkbox-label')],
                  [
                    h.span([h.Class('ff-checkbox-sizer'), h.AriaHidden(true)], [props.label]),
                    h.span([h.Class('ff-checkbox-text')], [props.label]),
                  ],
                ),
              ],
            ),
            props.name
              ? h.input([...hiddenInput, h.Disabled(!!props.disabled || !props.checked)])
              : null,
          ],
        ),
    },
    h,
  );
}

export * as Control from './control';
