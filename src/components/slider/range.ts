import { Slider as Primitive } from '@foldkit/ui';
import { Option } from 'effect';
import { Mount, Submodel } from 'foldkit';
import { Model, Message, type Value } from './range-state';
import * as Scalar from './state';
import { nearestIndex } from './values';
import { valueView } from './value';
import { Mounted } from './runtime';
import type { Props as ScalarProps } from './index';
import './styles.css';
export { Model, Message, OutMessage, init, update, subscriptions, type Value } from './range-state';
export interface Props extends Omit<ScalarProps, 'value' | 'size' | 'variant'> {
  readonly value: Value;
}
interface ThumbProps {
  readonly value: number;
  readonly label: string;
  readonly disabled?: boolean;
  readonly formatValue?: (value: number) => string;
}
const thumbView = Submodel.defineView<Scalar.Model, Scalar.Message, ThumbProps>((model, props, h) =>
  h.submodel({
    slotId: 'behavior',
    model: model.slider,
    view: Primitive.view,
    toParentMessage: (message) => Scalar.Message.PrimitiveMessage({ message }),
    viewInputs: {
      value: model.steps.length ? nearestIndex(props.value, model.steps) : props.value,
      ariaLabel: props.label,
      isDisabled: props.disabled,
      thumbAlignment: 'Edge',
      thumbSize: '20px',
      formatValue: model.steps.length
        ? (index) => props.formatValue?.(model.steps[index]!) ?? String(model.steps[index])
        : props.formatValue,
      toView: ({ track, thumb }) =>
        h.div(
          [...track, h.Class('ff-range-semantic-track')],
          [h.span([...thumb, h.Class('ff-slider-input')], [])],
        ),
    },
  }),
);
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const limits = Scalar.range(model.low),
    position = props.valuePosition ?? 'left',
    format = props.formatValue ?? String;
  const dragging =
    model.low.slider.dragState._tag === 'Dragging' ||
    model.high.slider.dragState._tag === 'Dragging';
  const display = () =>
    h.span(
      [h.Class('ff-range-values')],
      [
        // Ghosts for both ends, each "a – a" with the visible separator's
        // markup, so the cell takes the wider one (a negative min is wider).
        ...[limits.min, limits.max].map((end) =>
          h.span(
            [h.Class('ff-range-values-sizer'), h.AriaHidden(true)],
            [
              `${props.label ? props.label + ': ' : ''}${format(end)}`,
              h.span([h.Class('ff-range-separator')], ['–']),
              format(end),
            ],
          ),
        ),
        h.span(
          [h.Class('ff-range-values-content')],
          [
            props.label ? h.span([h.Class('ff-slider-value-label')], [`${props.label}: `]) : null,
            h.submodel({
              slotId: 'low-value',
              model: model.low,
              view: valueView,
              toParentMessage: (message) => Message.Low({ message }),
              viewInputs: {
                value: props.value[0],
                formatValue: props.formatValue,
                ariaLabel: 'Edit slider value (start)',
              },
            }),
            h.span([h.Class('ff-range-separator')], ['–']),
            h.submodel({
              slotId: 'high-value',
              model: model.high,
              view: valueView,
              toParentMessage: (message) => Message.High({ message }),
              viewInputs: {
                value: props.value[1],
                formatValue: props.formatValue,
                ariaLabel: 'Edit slider value (end)',
              },
            }),
          ],
        ),
      ],
    );
  const pointer = (
    _kind: string,
    button: number,
    _sx: number,
    _sy: number,
    _t: number,
    x: number,
    _y: number,
    _id: number,
    target: EventTarget | null,
  ) => {
    if (button !== 0 || props.disabled || !(target instanceof Element)) return Option.none();
    const track = target.closest<HTMLElement>('.ff-slider-track');
    if (!track) return Option.none();
    const bounds = track.getBoundingClientRect(),
      width = track.clientWidth,
      scale = bounds.width / track.offsetWidth || 1;
    const local = Math.max(0, Math.min(width - 20, (x - bounds.left) / scale - 10));
    const handles = [...track.querySelectorAll<HTMLElement>('.ff-slider-handle')];
    const positions = handles.map(
      (handle) => new DOMMatrixReadOnly(getComputedStyle(handle).transform).m41,
    );
    const index =
      Math.abs(local - (positions[0] ?? 0)) <= Math.abs(local - (positions[1] ?? 0)) ? 0 : 1;
    return Option.some(
      Message.PressedPointer({ index, fraction: local / Math.max(1, width - 20), width }),
    );
  };
  return h.div(
    [
      h.Class('ff-slider ff-range-slider'),
      h.DataAttribute('engine', 'compact'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('value-position', position),
      h.DataAttribute('value', String(props.value[0])),
      h.DataAttribute('high-value', String(props.value[1])),
      h.DataAttribute('min', String(limits.min)),
      h.DataAttribute('max', String(limits.max)),
      h.DataAttribute('step', String(limits.step)),
      h.DataAttribute('steps', model.low.steps.join(',')),
      h.DataAttribute('hovering', String(model.low.hover !== null)),
      h.DataAttribute(
        'hover-tooltip',
        String(
          model.low.hoverTooltip && model.low.hover !== null && !dragging && position !== 'tooltip',
        ),
      ),
      ...(dragging ? [h.DataAttribute('dragging', '')] : []),
      ...(props.disabled ? [h.DataAttribute('disabled', '')] : []),
      h.OnMount(Mount.mapMessage(Mounted(), (message) => Message.Low({ message }))),
    ],
    [
      h.div(
        [h.Class('ff-slider-hover-tooltip'), h.AriaHidden(true)],
        [format(model.low.lastHover)],
      ),
      props.showValue !== false && (position === 'left' || position === 'top') ? display() : null,
      h.div(
        [h.Class('ff-slider-track'), h.OnPointerDown(pointer)],
        [
          h.submodel({
            slotId: 'low',
            model: model.low,
            view: thumbView,
            toParentMessage: (message) => Message.Low({ message }),
            viewInputs: {
              value: props.value[0],
              label: props.label ? `${props.label} minimum` : 'Minimum',
              disabled: props.disabled,
              formatValue: props.formatValue,
            },
          }),
          h.submodel({
            slotId: 'high',
            model: model.high,
            view: thumbView,
            toParentMessage: (message) => Message.High({ message }),
            viewInputs: {
              value: props.value[1],
              label: props.label ? `${props.label} maximum` : 'Maximum',
              disabled: props.disabled,
              formatValue: props.formatValue,
            },
          }),
          h.div(
            [h.Class('ff-slider-pill'), h.AriaHidden(true)],
            [h.div([h.Class('ff-slider-fill')], []), h.div([h.Class('ff-slider-hover-bar')], [])],
          ),
          props.showSteps
            ? h.div(
                [h.Class('ff-slider-step-dots'), h.AriaHidden(true)],
                (model.low.steps.length
                  ? model.low.steps
                  : Array.from(
                      { length: Math.round((limits.max - limits.min) / limits.step) + 1 },
                      (_, i) => limits.min + i * limits.step,
                    )
                ).map((value) =>
                  h.span(
                    [
                      h.Style({
                        '--dot-fraction': String(
                          Primitive.fractionOfValue(value, limits.min, limits.max),
                        ),
                      }),
                    ],
                    [],
                  ),
                ),
              )
            : null,
          ...props.value.map((value, index) =>
            h.div(
              [
                h.Class('ff-slider-handle'),
                h.DataAttribute('thumb', String(index)),
                h.AriaHidden(true),
              ],
              [
                h.span([h.Class('ff-slider-knob')], []),
                position === 'tooltip' && props.showValue !== false
                  ? h.span([h.Class('ff-slider-thumb-tooltip')], [format(value)])
                  : null,
              ],
            ),
          ),
        ],
      ),
      props.showValue !== false && (position === 'right' || position === 'bottom')
        ? display()
        : null,
    ],
  );
});
