import { Slider as Primitive } from '@foldkit/ui';
import { Submodel } from 'foldkit';
import { Model, Message, range } from './state';
import { nearestIndex } from './values';
import { valueDisplay } from './value';
import { Mounted } from './runtime';
import './styles.css';
export * as Range from './range';

export {
  Model,
  Message,
  init,
  update,
  subscriptions,
  type InitConfig,
  type OutMessage,
} from './state';
export type ValuePosition = 'left' | 'right' | 'top' | 'bottom' | 'tooltip';
export interface Props {
  readonly value: number;
  readonly label: string;
  readonly size?: 'default' | 'compact';
  readonly variant?: 'pips' | 'scrubber';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly disabled?: boolean;
  readonly showSteps?: boolean;
  readonly showValue?: boolean;
  readonly valuePosition?: ValuePosition;
  readonly formatValue?: (value: number) => string;
  /** Upstream's color-rail props, compact engine only: inline styles on the
   * pill (a gradient track), no filled range, and the knob's fill and 1px
   * border colors. */
  readonly trackStyle?: Readonly<Record<string, string>>;
  readonly hideFill?: boolean;
  readonly thumbColor?: string;
  readonly thumbBorderColor?: string;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const slider = model.slider;
  const limits = range(model);
  // These feature props route to Fluid's compact engine even at default size.
  const compact =
    props.size === 'compact' ||
    props.showSteps !== undefined ||
    props.showValue !== undefined ||
    props.valuePosition !== undefined ||
    props.trackStyle !== undefined ||
    props.hideFill !== undefined ||
    props.thumbColor !== undefined ||
    props.thumbBorderColor !== undefined ||
    model.steps.length > 0;
  const fraction = Primitive.fractionOfValue(props.value, limits.min, limits.max);
  const formatted = props.formatValue?.(props.value) ?? String(props.value);
  const position = props.valuePosition ?? 'left';
  const displayValue = () => valueDisplay(model, props, h);
  return h.submodel({
    slotId: 'behavior',
    model: slider,
    view: Primitive.view,
    toParentMessage: (message) => Message.PrimitiveMessage({ message }),
    viewInputs: {
      value: model.steps.length ? nearestIndex(props.value, model.steps) : props.value,
      ariaLabel: props.label,
      formatValue: model.steps.length
        ? (index) => {
            const value = model.steps[index] ?? limits.min;
            return props.formatValue?.(value) ?? String(value);
          }
        : props.formatValue,
      isDisabled: props.disabled,
      thumbAlignment: compact ? 'Edge' : 'Center',
      thumbSize: '20px',
      toView: ({ root, track, thumb }) =>
        h.div(
          [
            ...root,
            h.Key(`${slider.id}-${compact ? 'compact' : (props.variant ?? 'pips')}`),
            h.Class('ff-slider'),
            h.DataAttribute('engine', compact ? 'compact' : (props.variant ?? 'pips')),
            h.DataAttribute('radius', props.radius ?? 'rounded'),
            h.DataAttribute('value-position', position),
            h.DataAttribute('hovering', String(model.hover !== null)),
            h.DataAttribute(
              'hover-tooltip',
              String(
                model.hoverTooltip &&
                  model.hover !== null &&
                  slider.dragState._tag === 'Idle' &&
                  position !== 'tooltip',
              ),
            ),
            h.DataAttribute('value', String(props.value)),
            h.DataAttribute('min', String(limits.min)),
            h.DataAttribute('max', String(limits.max)),
            h.DataAttribute('step', String(limits.step)),
            h.DataAttribute('steps', model.steps.join(',')),
            h.DataAttribute('at-min', String(props.value === limits.min)),
            h.OnMount(Mounted()),
          ],
          [
            h.div(
              [h.Class('ff-slider-hover-tooltip'), h.AriaHidden(true)],
              [props.formatValue?.(model.lastHover) ?? String(model.lastHover)],
            ),
            compact && props.showValue !== false && (position === 'left' || position === 'top')
              ? displayValue()
              : null,
            h.div(
              [
                ...track,
                h.Key('track'),
                h.Class('ff-slider-track'),
                h.Style({ '--slider-fraction': String(fraction) }),
              ],
              [
                h.span([...thumb, h.Class('ff-slider-input')], []),
                !compact ? h.div([h.Class('ff-slider-hover-bar'), h.AriaHidden(true)], []) : null,
                compact
                  ? h.div(
                      [
                        h.Class('ff-slider-pill'),
                        h.AriaHidden(true),
                        ...(props.trackStyle ? [h.Style(props.trackStyle)] : []),
                      ],
                      [
                        props.hideFill ? null : h.div([h.Class('ff-slider-fill')], []),
                        h.div([h.Class('ff-slider-hover-bar')], []),
                      ],
                    )
                  : null,
                compact && props.showSteps
                  ? h.div(
                      [h.Class('ff-slider-step-dots'), h.AriaHidden(true)],
                      (model.steps.length
                        ? model.steps
                        : Array.from(
                            { length: Math.round((limits.max - limits.min) / limits.step) + 1 },
                            (_, i) => limits.min + i * limits.step,
                          )
                      ).map((value) =>
                        h.span(
                          [
                            h.Attribute(
                              'style',
                              `--dot-fraction:${Primitive.fractionOfValue(value, limits.min, limits.max)}`,
                            ),
                          ],
                          [],
                        ),
                      ),
                    )
                  : null,
                !compact && props.variant !== 'scrubber'
                  ? h.div(
                      [h.Class('ff-slider-pips'), h.AriaHidden(true)],
                      Array.from(
                        { length: Math.round((limits.max - limits.min) / limits.step) + 1 },
                        (_, i) =>
                          h.span(
                            [
                              h.DataAttribute(
                                'current',
                                String(limits.min + i * limits.step === props.value),
                              ),
                            ],
                            [],
                          ),
                      ),
                    )
                  : null,
                !compact && props.variant !== 'scrubber'
                  ? h.div(
                      [h.Class('ff-slider-row-mask'), h.AriaHidden(true)],
                      [
                        h.span([], [props.label]),
                        h.span(
                          [
                            h.Style({
                              'min-width': `${String(props.formatValue?.(limits.max) ?? limits.max).length}ch`,
                            }),
                          ],
                          [formatted],
                        ),
                      ],
                    )
                  : null,
                !compact ? h.div([h.Class('ff-slider-row-fill'), h.AriaHidden(true)], []) : null,
                h.div(
                  [h.Key('handle'), h.Class('ff-slider-handle'), h.AriaHidden(true)],
                  compact
                    ? [
                        h.span(
                          [
                            h.Class('ff-slider-knob'),
                            ...(props.thumbColor || props.thumbBorderColor
                              ? [
                                  h.Style({
                                    ...(props.thumbColor
                                      ? { backgroundColor: props.thumbColor }
                                      : {}),
                                    ...(props.thumbBorderColor
                                      ? { border: `1px solid ${props.thumbBorderColor}` }
                                      : {}),
                                  }),
                                ]
                              : []),
                          ],
                          [],
                        ),
                        position === 'tooltip' && props.showValue !== false
                          ? h.span([h.Class('ff-slider-thumb-tooltip')], [formatted])
                          : null,
                      ]
                    : [],
                ),
                !compact
                  ? h.div(
                      [h.Class('ff-slider-row-labels'), h.AriaHidden(true)],
                      [
                        h.span([], [props.label]),
                        h.span(
                          [
                            h.Attribute(
                              'style',
                              `min-width:${String(props.formatValue?.(limits.max) ?? limits.max).length}ch`,
                            ),
                          ],
                          [formatted],
                        ),
                      ],
                    )
                  : null,
              ],
            ),
            compact && props.showValue !== false && (position === 'right' || position === 'bottom')
              ? displayValue()
              : null,
          ],
        ),
    },
  });
});
