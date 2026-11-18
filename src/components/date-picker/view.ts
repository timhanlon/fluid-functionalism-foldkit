import { Option } from 'effect';
import { Popover } from '@foldkit/ui';
import { Submodel } from 'foldkit';
import type { Attribute, ChildAttribute } from 'foldkit/html';
import * as Calendar from '../calendar';
import { icon } from '../icons';
import { key, toNative } from '../calendar/dates';
import {
  formatDateLabel,
  formatRangeLabel,
  formValue,
  labelParts,
  rangeLabelOptions,
  rangeWithYear,
  singleLabelOptions,
  widestLabelParts,
} from './labels';
import { Model, Message, value, calendarOptions, orientation, months, type Options } from './state';
import * as TimeView from './time-field-view';
import { formatDuration, timeToMinutes } from './time';
import { timeMode, timeValue, timeRangeValue, timeOptions, type TimeFieldName } from './state';
import { ClearMounted } from './clear-runtime';
import { Mounted, PanelMounted } from './runtime';
import '../popup/styles.css';
import './styles.css';
export interface Props extends Options {
  readonly variant?: 'outline' | 'ghost';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly placeholder?: string;
  readonly clearable?: boolean;
  readonly locale?: string;
  readonly icons?: string;
  readonly label?: string;
  /** Size the date trigger to its current label instead of reserving the widest date. */
  readonly fitLabel?: boolean;
  readonly name?: string;
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const triggerId = Popover.buttonId(model.popover.id);
  const selected = value(model, props),
    native = Calendar.toSelected(selected),
    rangeMode = props.mode === 'range',
    hasValue = rangeMode
      ? selected._tag === 'Range' && Option.isSome(selected.from)
      : selected._tag === 'Single',
    placeholder = props.placeholder ?? (rangeMode ? 'Pick dates' : 'Pick a date'),
    now = toNative(model.today),
    label = hasValue
      ? selected._tag === 'Single'
        ? formatDateLabel(toNative(selected.date), props.locale, now)
        : formatRangeLabel(native as Calendar.DateRange, props.locale, now)
      : placeholder;
  const sampleDate =
    selected._tag === 'Single' ? toNative(selected.date) : new Date(model.today.year, 0, 1);
  const nativeRange =
    selected._tag === 'Range' ? (Calendar.toSelected(selected) as Calendar.DateRange) : undefined;
  const formatOptions = rangeMode
    ? rangeLabelOptions(rangeWithYear(nativeRange ?? { from: undefined }, now))
    : singleLabelOptions(sampleDate.getFullYear() !== model.today.year);
  const sample = rangeMode
    ? [
        ...labelParts(nativeRange?.from ?? sampleDate, props.locale, formatOptions),
        { type: 'literal' as const, value: ' → ' },
        ...labelParts(
          nativeRange?.to ?? nativeRange?.from ?? sampleDate,
          props.locale,
          formatOptions,
        ),
      ]
    : labelParts(sampleDate, props.locale, formatOptions);
  const sizer = props.fitLabel ? [] : widestLabelParts(sample, props.locale, formatOptions),
    stacked = orientation(model, props) === 'vertical',
    showPresets = rangeMode && !!props.presets?.length;
  const presetList = () =>
    h.div(
      [
        h.Class('ff-date-picker-presets'),
        h.DataAttribute('slot', 'date-picker-presets'),
        h.Role('group'),
        h.AriaLabel('Presets'),
      ],
      (props.presets ?? []).map((preset, index) => {
        const active =
          selected._tag === 'Range' &&
          Option.isSome(selected.from) &&
          Option.isSome(selected.to) &&
          !!preset.range.from &&
          !!preset.range.to &&
          key(selected.from.value) === key(Calendar.fromNative(preset.range.from)) &&
          key(selected.to.value) === key(Calendar.fromNative(preset.range.to));
        return h.button(
          [
            h.Type('button'),
            h.Class('ff-date-picker-preset'),
            h.AriaPressed(String(active)),
            h.OnClick(Message.Preset({ index })),
          ],
          [
            h.span(
              [h.Class('ff-date-picker-preset-label')],
              [
                h.span(
                  [h.AriaHidden(true), h.Class('ff-date-picker-preset-sizer')],
                  [preset.label],
                ),
                h.span([], [preset.label]),
              ],
            ),
          ],
        );
      }),
    );
  const kind = timeMode(model, props),
    time = timeValue(model, props),
    range = timeRangeValue(model, props),
    timed = kind !== 'none',
    twoRows = timed && model.twoRows;
  const clearWanted =
    props.variant !== 'ghost' &&
    props.clearable !== false &&
    (hasValue || (kind === 'time' && !!time) || (kind === 'range' && !!range));
  const start = timeToMinutes(range?.start),
    end = timeToMinutes(range?.end),
    duration =
      start !== null && end !== null && end > start ? formatDuration(end - start) : undefined;
  const timeField = (field: TimeFieldName) =>
    h.submodel({
      slotId: `time-${field}`,
      model: model.timeFields[field],
      view: TimeView.view,
      toParentMessage: (message) => Message.TimeField({ field, message }),
      viewInputs: {
        ...timeOptions(model, props, field),
        liveAnchorId: model.id,
        radius: props.radius,
        label: field === 'time' ? 'Time' : field === 'start' ? 'Start time' : 'End time',
        placeholder: field === 'time' ? 'Time' : field === 'start' ? 'Start' : 'End',
        size: props.size,
        prefix: h.span(
          [h.Class('ff-date-picker-icon'), h.AriaHidden(true)],
          [icon(field === 'end' ? 'arrow-right' : 'clock', props.icons, h)],
        ),
        suffix:
          field === 'end' && duration
            ? h.span(
                [
                  h.Class('ff-date-picker-duration'),
                  h.DataAttribute('slot', 'date-picker-duration'),
                ],
                [duration],
              )
            : undefined,
      },
    });
  return h.div(
    [
      h.Id(model.id),
      h.Class('ff-date-picker'),
      h.Role('group'),
      ...(props.label ? [h.AriaLabel(props.label)] : []),
      h.DataAttribute('slot', 'date-picker'),
      h.DataAttribute('variant', props.variant ?? 'outline'),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('disabled', String(!!props.disabled)),
      h.DataAttribute('clear-wanted', String(clearWanted)),
      h.DataAttribute('time-kind', kind),
      h.DataAttribute('two-rows', String(twoRows)),
      h.DataAttribute('ack-pending', String(model.ackPending)),
      h.DataAttribute('ack-generation', String(model.ackGeneration)),
      h.DataAttribute('external-open', props.open === undefined ? '' : String(props.open)),
      h.OnMount(Mounted()),
      ...(props.attributes ?? []),
    ],
    [
      props.name
        ? h.input([
            h.Type('hidden'),
            h.Name(props.name),
            h.Value(
              formValue(native, kind === 'time' ? time : null, kind === 'range' ? range : null),
            ),
          ])
        : null,
      h.submodel({
        slotId: 'popover',
        model: model.popover,
        view: Popover.view,
        toParentMessage: (message) => Message.Popover({ message }),
        viewInputs: {
          anchor: { placement: 'bottom-start', gap: 6, padding: 8, portal: true },
          isDisabled: props.disabled,
          focusSelector: props.typeable
            ? `#${CSS.escape(triggerId)}`
            : '.ff-calendar-day[tabindex="0"]',
          toView: (info) =>
            h.div(
              [h.Class('ff-date-picker-date')],
              [
                // Keep the focused trigger in place when the backdrop enters or leaves.
                props.typeable
                  ? h.label(
                      [
                        h.For(triggerId),
                        h.Class('ff-date-picker-trigger ff-date-picker-typed-trigger'),
                        h.DataAttribute('slot', 'date-picker-trigger'),
                        h.DataAttribute('datepicker-segment', ''),
                        h.DataAttribute('open', String(model.popover.isOpen)),
                        h.DataAttribute('placeholder', String(!hasValue && !model.typedDate)),
                      ],
                      [
                        props.variant !== 'ghost'
                          ? h.span(
                              [h.Class('ff-date-picker-icon'), h.AriaHidden(true)],
                              [icon('calendar', props.icons, h)],
                            )
                          : null,
                        h.span(
                          [h.Class('ff-date-picker-label')],
                          [
                            h.span(
                              [h.AriaHidden(true), h.Class('ff-date-picker-placeholder-sizer')],
                              [(model.typedDate ?? (hasValue ? label : '')) || placeholder],
                            ),
                            ...(!props.fitLabel
                              ? [
                                  h.span(
                                    [h.Class('ff-date-picker-label-sizer'), h.AriaHidden(true)],
                                    sizer.map((parts) =>
                                      h.span(
                                        [],
                                        parts.map((part) => h.span([], [part])),
                                      ),
                                    ),
                                  ),
                                ]
                              : []),
                            h.input([
                              h.Id(triggerId),
                              h.Class('ff-date-picker-text'),
                              h.Type('text'),
                              h.Attribute('size', '1'),
                              h.Autocomplete('off'),
                              h.Spellcheck(false),
                              h.Disabled(!!props.disabled),
                              h.Role('combobox'),
                              h.AriaLabel(props.label ?? placeholder),
                              h.AriaExpanded(info.isVisible),
                              h.AriaHasPopup('dialog'),
                              ...(info.isVisible
                                ? [h.AriaControls(`${model.popover.id}-panel`)]
                                : []),
                              h.Placeholder(placeholder),
                              h.Value(model.typedDate ?? (hasValue ? label : '')),
                              h.OnClick(
                                Message.Popover({ message: Popover.Message.RequestedOpen() }),
                              ),
                              h.OnInput((text) => Message.DateTextChanged({ text })),
                              h.OnKeyDownPreventDefault((key) =>
                                key === 'Enter'
                                  ? Option.some(Message.DateTextCommitted())
                                  : key === 'Escape' && (info.isVisible || model.typedDate !== null)
                                    ? Option.some(Message.DateTextReverted())
                                    : key === 'ArrowDown'
                                      ? Option.some(
                                          Message.Popover({
                                            message: Popover.Message.RequestedOpen(),
                                          }),
                                        )
                                      : Option.none(),
                              ),
                            ]),
                          ],
                        ),
                      ],
                    )
                  : h.button(
                      [
                        ...info.button,
                        h.Class('ff-date-picker-trigger'),
                        h.Disabled(!!props.disabled),
                        h.AriaHasPopup('dialog'),
                        h.DataAttribute('open', String(model.popover.isOpen)),
                        h.DataAttribute('slot', 'date-picker-trigger'),
                        h.DataAttribute('datepicker-segment', ''),
                        h.DataAttribute('placeholder', String(!hasValue)),
                        ...(props.label ? [h.AriaLabel(`${props.label}: ${label}`)] : []),
                      ],
                      [
                        props.variant !== 'ghost'
                          ? h.span(
                              [h.Class('ff-date-picker-icon'), h.AriaHidden(true)],
                              [icon('calendar', props.icons, h)],
                            )
                          : null,
                        h.span(
                          [h.Class('ff-date-picker-label')],
                          [
                            h.span([], [label]),
                            ...(props.fitLabel
                              ? []
                              : [
                                  h.span(
                                    [h.Class('ff-date-picker-label-sizer'), h.AriaHidden(true)],
                                    sizer.map((parts) =>
                                      h.span(
                                        [],
                                        parts.map((part) => h.span([], [part])),
                                      ),
                                    ),
                                  ),
                                  h.span(
                                    [
                                      h.Class('ff-date-picker-placeholder-sizer'),
                                      h.AriaHidden(true),
                                    ],
                                    [placeholder],
                                  ),
                                ]),
                          ],
                        ),
                      ],
                    ),
                info.isVisible
                  ? h.div(
                      [
                        ...info.backdrop,
                        h.Class('ff-popup-backdrop'),
                        h.AriaHidden(true),
                        h.DataAttribute('slot', 'popup-shield'),
                        h.DataAttribute('shield-for', `${model.popover.id}-panel`),
                        h.DataAttribute('shield-anchor', model.id),
                      ],
                      [],
                    )
                  : null,
                info.isVisible && !(model.needsEntrance && props.open === false)
                  ? h.div(
                      [
                        ...info.panel,
                        h.Class('ff-popup ff-date-picker-popup'),
                        h.Role('dialog'),
                        h.AriaLabel(props.label ?? (rangeMode ? 'Choose dates' : 'Choose a date')),
                        h.DataAttribute('slot', 'date-picker-popup'),
                        h.DataAttribute('radius', props.radius === 'sharp' ? 'sharp' : 'rounded'),
                        h.DataAttribute('initial-open', String(model.needsEntrance)),
                        h.DataAttribute('open', String(model.popover.isOpen)),
                        h.DataAttribute('size', props.size ?? 'default'),
                        h.DataAttribute('stacked', String(stacked)),
                        h.DataAttribute('presets', String(showPresets)),
                        h.DataAttribute('months', String(months(props))),
                      ],
                      [
                        h.div(
                          [h.Class('ff-date-picker-content'), h.OnMount(PanelMounted())],
                          [
                            showPresets && !stacked ? presetList() : null,
                            h.div(
                              [h.Class('ff-date-picker-calendar')],
                              [
                                h.submodel({
                                  slotId: 'calendar',
                                  model: model.calendar,
                                  view: Calendar.view,
                                  toParentMessage: (message) => Message.Calendar({ message }),
                                  viewInputs: {
                                    ...calendarOptions(model, props),
                                    radius: props.radius,
                                    icons: props.icons,
                                    locale: props.calendarProps?.locale ?? props.locale,
                                  },
                                }),
                              ],
                            ),
                            showPresets && stacked ? presetList() : null,
                          ],
                        ),
                      ],
                    )
                  : null,
              ],
            ),
        },
      }),
      timed && !twoRows
        ? h.span([h.Class('ff-date-picker-time-divider'), h.AriaHidden(true)], [])
        : null,
      twoRows ? h.span([h.Class('ff-date-picker-row-divider'), h.AriaHidden(true)], []) : null,
      timed
        ? h.span(
            [h.Class('ff-date-picker-times')],
            kind === 'time' ? [timeField('time')] : [timeField('start'), timeField('end')],
          )
        : null,
      clearWanted || model.clearState === 'visible' || model.clearState === 'leaving'
        ? h.button(
            [
              h.Type('button'),
              h.Key('clear'),
              h.Class('ff-date-picker-clear'),
              h.DataAttribute('clear-state', model.clearState),
              h.DataAttribute('clear-generation', String(model.clearGeneration)),
              h.OnMount(ClearMounted()),
              h.DataAttribute('slot', 'date-picker-clear'),
              h.DataAttribute('datepicker-segment', ''),
              h.AriaLabel('Clear'),
              h.Disabled(!!props.disabled),
              h.OnClick(Message.Clear()),
            ],
            [icon('x', props.icons, h)],
          )
        : null,
    ],
  );
});
