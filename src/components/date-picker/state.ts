import { Option, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { Popover, Animation } from '@foldkit/ui';
import * as Calendar from '../calendar';
import { Day, firstOfMonth, isEqual } from '../calendar/dates';
import { TimeRange, type Preset } from './types';
import * as TimeField from './time-field-model';
import type * as TimeEdit from './time-field-state';
import {
  buildSlots,
  changeTimeRange,
  minutesToTime,
  resolveHourCycle,
  timeToMinutes,
  type TimeSlot,
} from './time';
export type TimeMode = 'none' | 'time' | 'range';
export type TimeFieldName = 'time' | 'start' | 'end';
export interface Options {
  readonly timeMode?: TimeMode;
  readonly time?: string | null;
  readonly timeRange?: TimeRange | null;
  readonly timeControlled?: boolean;
  readonly timeRangeControlled?: boolean;
  readonly step?: number;
  readonly hourCycle?: 12 | 24;
  readonly locale?: string;
  readonly mode?: 'single' | 'range';
  readonly controlled?: boolean;
  readonly value?: Calendar.Selection;
  readonly open?: boolean;
  readonly disabled?: boolean;
  readonly size?: 'default' | 'compact';
  readonly numberOfMonths?: 1 | 2;
  readonly orientation?: Calendar.Orientation;
  readonly presets?: readonly Preset[];
  readonly calendarProps?: Omit<
    Calendar.Props,
    'mode' | 'selected' | 'controlled' | 'month' | 'numberOfMonths' | 'orientation' | 'size'
  >;
}
export const Model = Schema.Struct({
  id: Schema.String,
  needsEntrance: Schema.Boolean,
  clearState: Schema.Literals(['initial', 'hidden', 'visible', 'leaving']),
  clearGeneration: Schema.Number,
  timeMode: Schema.Literals(['none', 'time', 'range']),
  time: Schema.NullOr(Schema.String),
  timeRange: Schema.NullOr(TimeRange),
  timeFields: Schema.Struct({
    time: TimeField.Model,
    start: TimeField.Model,
    end: TimeField.Model,
  }),
  nowMinutes: Schema.Number,
  twoRows: Schema.Boolean,
  today: Day,
  value: Calendar.Selection,
  draft: Schema.Option(Calendar.Selection),
  calendar: Calendar.Model,
  popover: Popover.Model,
  viewportWidth: Schema.Number,
  ackGeneration: Schema.Number,
  ackPending: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  TimeField: { field: Schema.Literals(['time', 'start', 'end']), message: TimeField.Message },
  Clock: { minutes: Schema.Number },
  RowsChanged: { twoRows: Schema.Boolean },
  TimeModeChanged: { mode: Schema.Literals(['none', 'time', 'range']) },
  Ready: {},
  TriggerClicked: {},
  ClearObserved: { show: Schema.Boolean },
  ClearExited: { generation: Schema.Number },
  Popover: { message: Popover.Message },
  Calendar: { message: Calendar.Message },
  Preset: { index: Schema.Number },
  Clear: {},
  Acknowledged: { generation: Schema.Number },
  SyncOpen: { open: Schema.Boolean },
  Viewport: { width: Schema.Number },
  Noop: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  TimeChanged: { time: Schema.NullOr(Schema.String) },
  TimeRangeChanged: { range: Schema.NullOr(TimeRange) },
  Cleared: {
    value: Calendar.Selection,
    time: Schema.NullOr(Schema.String),
    timeRange: Schema.NullOr(TimeRange),
    timeMode: Schema.Literals(['time', 'range']),
  },
  ValueChanged: { value: Calendar.Selection },
  OpenChanged: { open: Schema.Boolean },
});
export type OutMessage = typeof OutMessage.Type;
export const init = (config: {
  readonly id: string;
  readonly timeMode?: TimeMode;
  readonly defaultTime?: string | null;
  readonly defaultTimeRange?: TimeRange | null;
  readonly nowMinutes?: number;
  readonly today: Calendar.Day;
  readonly defaultValue?: Calendar.Selection;
  readonly defaultOpen?: boolean;
  readonly viewportWidth?: number;
}): Model => {
  const now = new Date();
  const popover = Popover.init({
    id: `${config.id}-date`,
    isAnimated: true,
    isModal: false,
    contentFocus: true,
  });
  const value = config.defaultValue ?? Calendar.none(),
    anchor =
      value._tag === 'Single'
        ? value.date
        : value._tag === 'Range'
          ? Option.getOrUndefined(value.from)
          : undefined;
  return {
    id: config.id,
    needsEntrance: config.defaultOpen ?? false,
    clearState: 'initial',
    clearGeneration: 0,
    timeMode:
      config.timeMode ??
      ('defaultTime' in config ? 'time' : 'defaultTimeRange' in config ? 'range' : 'none'),
    time: config.defaultTime ?? null,
    timeRange: config.defaultTimeRange ?? null,
    timeFields: initTimeFields(config.id),
    nowMinutes: config.nowMinutes ?? now.getHours() * 60 + now.getMinutes(),
    twoRows: false,
    today: config.today,
    value,
    draft: Option.none(),
    calendar: Calendar.init({ id: `${config.id}-calendar`, today: config.today, month: anchor }),
    popover: {
      ...popover,
      isOpen: config.defaultOpen ?? false,
      animation: { ...popover.animation, isShowing: config.defaultOpen ?? false },
    },
    viewportWidth: config.viewportWidth ?? 1024,
    ackGeneration: 0,
    ackPending: false,
  };
};
const initTimeFields = (id: string) => ({
  time: TimeField.init(`${id}-time`),
  start: TimeField.init(`${id}-start`),
  end: TimeField.init(`${id}-end`),
});
export const timeMode = (model: Model, options: Options): TimeMode =>
  options.timeMode ??
  ('time' in options ? 'time' : 'timeRange' in options ? 'range' : model.timeMode);
export const timeValue = (model: Model, options: Options): string | null =>
  (options.timeControlled ?? 'time' in options) ? (options.time ?? null) : model.time;
export const timeRangeValue = (model: Model, options: Options): TimeRange | null =>
  (options.timeRangeControlled ?? 'timeRange' in options)
    ? (options.timeRange ?? null)
    : model.timeRange;
// Keep the slot arrays stable like the reference's useMemo, so formatting and
// invisible width candidates are reused while the pointer crosses the list.
const slotCache = new Map<string, readonly TimeSlot[]>();
function slots(step: number, after?: number): readonly TimeSlot[] {
  const key = `${step}:${after ?? 'day'}`;
  const cached = slotCache.get(key);
  if (cached) return cached;
  const result = buildSlots(step, after);
  if (slotCache.size >= 64) slotCache.delete(slotCache.keys().next().value!);
  slotCache.set(key, result);
  return result;
}
export function timeOptions(
  model: Model,
  options: Options,
  field: TimeFieldName,
): TimeEdit.Options {
  const range = timeRangeValue(model, options),
    start = timeToMinutes(range?.start),
    step = options.step ?? 15;
  return {
    value: timeToMinutes(
      field === 'time' ? timeValue(model, options) : field === 'start' ? range?.start : range?.end,
    ),
    slots:
      field === 'end'
        ? slots(step, start ?? model.nowMinutes - (model.nowMinutes % step))
        : slots(step),
    fallback: field === 'end' ? (start ?? model.nowMinutes) + 60 : model.nowMinutes,
    hourCycle: resolveHourCycle(options.locale, options.hourCycle),
    locale: options.locale,
    disabled: options.disabled,
  };
}
export const value = (model: Model, options: Options): Calendar.Selection =>
  options.controlled ? (options.value ?? Calendar.none()) : model.value;
export const months = (options: Options): 1 | 2 =>
  options.numberOfMonths ?? (options.mode === 'range' ? 2 : 1);
export const orientation = (model: Model, options: Options): 'horizontal' | 'vertical' => {
  if (options.orientation && options.orientation !== 'auto') return options.orientation;
  const cell = options.calendarProps?.cellSize ?? (options.size === 'compact' ? 32 : 36);
  const needed =
    (7 + (options.calendarProps?.showWeekNumber ? 0.75 : 0)) * cell * 2 +
    24 +
    24 +
    (options.mode === 'range' && options.presets?.length ? 152 : 0);
  return model.viewportWidth - 16 >= needed ? 'horizontal' : 'vertical';
};
export const calendarOptions = (model: Model, options: Options): Calendar.Props => ({
  ...options.calendarProps,
  mode: options.mode ?? 'single',
  ...(options.mode !== 'range' ? { required: true } : {}),
  controlled: true,
  selected: Option.getOrElse(model.draft, () => value(model, options)),
  numberOfMonths: months(options),
  orientation: orientation(model, options),
  size: options.size,
  autoFocus: true,
  month: model.calendar.month,
});
export const triggerId = (id: string): string => Popover.buttonId(`${id}-date`);
const setValue = (model: Model, next: Calendar.Selection, options: Options): Model => ({
  ...model,
  value: options.controlled ? model.value : next,
});
function transition(
  model: Model,
  message: Popover.Message,
  options: Options,
  external = false,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  const result = Popover.update(model.popover, message),
    changed = result.model.isOpen !== model.popover.isOpen;
  if (changed && !external && options.open !== undefined)
    return {
      model: {
        ...model,
        popover: {
          ...model.popover,
          maybeLastButtonPointerType: result.model.maybeLastButtonPointerType,
        },
      },
      outMessage: OutMessage.OpenChanged({ open: result.model.isOpen }),
    };
  let next: Model = {
    ...model,
    popover:
      external && options.open !== undefined
        ? { ...result.model, maybeLastButtonPointerType: model.popover.maybeLastButtonPointerType }
        : result.model,
  };
  if (changed) {
    next = {
      ...next,
      ackGeneration: model.ackGeneration + 1,
      ackPending: false,
      draft: Option.none(),
    };
    if (result.model.isOpen) {
      const current = value(model, options),
        anchor =
          current._tag === 'Single'
            ? current.date
            : current._tag === 'Range'
              ? Option.getOrUndefined(current.from)
              : undefined;
      next = {
        ...next,
        calendar: Calendar.init({
          id: `${model.id}-calendar`,
          today: model.today,
          month: anchor,
          startMonth: options.calendarProps?.startMonth,
          endMonth: options.calendarProps?.endMonth,
          numberOfMonths: months(options),
        }),
      };
    }
  }
  return {
    model: next,
    commands: (result.commands ?? []).map((command) =>
      Command.mapMessage(command, (message) => Message.Popover({ message })),
    ),
    ...(changed && !external
      ? { outMessage: OutMessage.OpenChanged({ open: result.model.isOpen }) }
      : {}),
  };
}
function selected(
  model: Model,
  next: Calendar.Selection,
  options: Options,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (options.mode !== 'range')
    return {
      model: {
        ...setValue(model, next, options),
        ackPending: next._tag === 'Single',
        ackGeneration: model.ackGeneration + 1,
      },
      outMessage: OutMessage.ValueChanged({ value: next }),
    };
  if (next._tag === 'Range' && Option.isSome(next.from) && Option.isNone(next.to))
    return { model: { ...model, draft: Option.some(next) } };
  const draft = Option.getOrUndefined(model.draft),
    updated = { ...model, draft: Option.none<Calendar.Selection>() };
  if (!draft)
    return {
      model: setValue(updated, next, options),
      outMessage: OutMessage.ValueChanged({ value: next }),
    };
  const start = draft._tag === 'Range' ? Option.getOrUndefined(draft.from) : undefined;
  const completes =
    next._tag === 'Range' &&
    Option.isSome(next.from) &&
    Option.isSome(next.to) &&
    !!start &&
    (isEqual(next.from.value, start) || isEqual(next.to.value, start));
  return completes
    ? {
        model: {
          ...setValue(updated, next, options),
          ackPending: true,
          ackGeneration: model.ackGeneration + 1,
        },
        outMessage: OutMessage.ValueChanged({ value: next }),
      }
    : { model: updated };
}
export function update(
  model: Model,
  message: Message,
  options: Options = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  switch (message._tag) {
    case 'Ready': {
      if (!model.needsEntrance) return { model };
      const next = { ...model, needsEntrance: false };
      return model.popover.isOpen
        ? transition(
            {
              ...next,
              popover: {
                ...model.popover,
                animation: { ...model.popover.animation, isShowing: false },
              },
            },
            Popover.Message.GotAnimationMessage({ message: Animation.Message.Showed() }),
            options,
            true,
          )
        : { model: next };
    }
    case 'TriggerClicked':
      return options.disabled
        ? { model }
        : transition(
            model,
            model.popover.isOpen
              ? Popover.Message.RequestedClose()
              : Popover.Message.RequestedOpen(),
            options,
          );
    case 'ClearObserved': {
      if (model.clearState === 'initial')
        return { model: { ...model, clearState: message.show ? 'visible' : 'hidden' } };
      if (message.show)
        return model.clearState === 'visible'
          ? { model }
          : {
              model: {
                ...model,
                clearState: 'visible',
                clearGeneration: model.clearGeneration + 1,
              },
            };
      return model.clearState === 'visible'
        ? { model: { ...model, clearState: 'leaving', clearGeneration: model.clearGeneration + 1 } }
        : { model };
    }
    case 'ClearExited':
      return model.clearState === 'leaving' && model.clearGeneration === message.generation
        ? { model: { ...model, clearState: 'hidden' } }
        : { model };
    case 'Clock':
      return {
        model:
          model.nowMinutes === message.minutes ? model : { ...model, nowMinutes: message.minutes },
      };
    case 'RowsChanged':
      return {
        model: model.twoRows === message.twoRows ? model : { ...model, twoRows: message.twoRows },
      };
    case 'TimeModeChanged':
      return {
        model:
          message.mode === model.timeMode
            ? model
            : {
                ...model,
                timeMode: message.mode,
                timeFields: {
                  time: TimeField.reset(model.timeFields.time),
                  start: TimeField.reset(model.timeFields.start),
                  end: TimeField.reset(model.timeFields.end),
                },
              },
      };
    case 'TimeField': {
      const mode = timeMode(model, options);
      if (
        mode === 'none' ||
        (mode === 'time' && message.field !== 'time') ||
        (mode === 'range' && message.field === 'time')
      )
        return { model };
      const result = TimeField.update(
        model.timeFields[message.field],
        message.message,
        timeOptions(model, options, message.field),
      );
      let next: Model = {
        ...model,
        timeFields: { ...model.timeFields, [message.field]: result.model },
      };
      const commands = (result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message_) =>
          Message.TimeField({ field: message.field, message: message_ }),
        ),
      );
      if (!result.outMessage) return { model: next, commands };
      if (message.field === 'time') {
        const time = minutesToTime(result.outMessage.minutes);
        if (!(options.timeControlled ?? 'time' in options)) next = { ...next, time };
        return { model: next, commands, outMessage: OutMessage.TimeChanged({ time }) };
      }
      const range = changeTimeRange(
        timeRangeValue(model, options),
        message.field,
        result.outMessage.minutes,
      );
      if (!range) return { model: next, commands };
      if (!(options.timeRangeControlled ?? 'timeRange' in options))
        next = { ...next, timeRange: range };
      return { model: next, commands, outMessage: OutMessage.TimeRangeChanged({ range }) };
    }
    case 'Noop':
      return { model };
    case 'Viewport':
      return {
        model:
          model.viewportWidth === message.width
            ? model
            : { ...model, viewportWidth: message.width },
      };
    case 'SyncOpen':
      // A controlled closed value wins over defaultOpen before the first
      // entrance. Do not flash a leaving frame or move focus for that popup.
      if (!message.open && model.needsEntrance)
        return {
          model: {
            ...model,
            needsEntrance: false,
            popover: {
              ...model.popover,
              isOpen: false,
              animation: {
                ...model.popover.animation,
                isShowing: false,
                transitionState: 'Idle',
                transitionGeneration: model.popover.animation.transitionGeneration + 1,
              },
            },
          },
        };
      return message.open === model.popover.isOpen
        ? { model }
        : transition(
            model,
            message.open ? Popover.Message.RequestedOpen() : Popover.Message.RequestedClose(),
            options,
            true,
          );
    case 'Popover':
      return options.disabled && !model.popover.isOpen
        ? { model }
        : transition(model, message.message, options);
    case 'Acknowledged':
      return message.generation !== model.ackGeneration || !model.ackPending
        ? { model }
        : transition({ ...model, ackPending: false }, Popover.Message.RequestedClose(), options);
    case 'Clear': {
      if (options.disabled) return { model };
      const mode = timeMode(model, options),
        next = setValue(
          {
            ...model,
            draft: Option.none(),
            ...(mode === 'time' && !(options.timeControlled ?? 'time' in options)
              ? { time: null }
              : {}),
            ...(mode === 'range' && !(options.timeRangeControlled ?? 'timeRange' in options)
              ? { timeRange: null }
              : {}),
          },
          Calendar.none(),
          options,
        );
      return {
        model: next,
        outMessage:
          mode === 'none'
            ? OutMessage.ValueChanged({ value: Calendar.none() })
            : OutMessage.Cleared({
                value: Calendar.none(),
                time: null,
                timeRange: null,
                timeMode: mode,
              }),
      };
    }
    case 'Preset': {
      if (options.disabled || options.mode !== 'range') return { model };
      const preset = options.presets?.[message.index];
      if (!preset) return { model };
      const selection = Calendar.fromSelected(preset.range);
      const next = setValue({ ...model, draft: Option.none() }, selection, options);
      return {
        model: {
          ...next,
          calendar: {
            ...next.calendar,
            month: preset.range.from
              ? firstOfMonth(Calendar.fromNative(preset.range.from))
              : next.calendar.month,
          },
        },
        outMessage: OutMessage.ValueChanged({ value: selection }),
      };
    }
    case 'Calendar': {
      if (options.disabled) return { model };
      const result = Calendar.update(
        model.calendar,
        message.message,
        calendarOptions(model, options),
      );
      const next = {
        ...model,
        calendar:
          result.outMessage?._tag === 'MonthChanged'
            ? { ...result.model, month: result.outMessage.month }
            : result.model,
      };
      const selection =
        result.outMessage?._tag === 'Selected'
          ? selected(next, result.outMessage.selection, options)
          : { model: next };
      return {
        ...selection,
        commands: [
          ...(result.commands ?? []).map((command) =>
            Command.mapMessage(command, (message) => Message.Calendar({ message })),
          ),
          ...(selection.commands ?? []),
        ],
      };
    }
  }
}
