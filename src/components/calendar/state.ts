import { Effect, Option, Schema } from 'effect';
import { Command, Dom, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as Tooltip from '../tooltip';
import {
  Day,
  addMonths,
  compare,
  firstOfMonth,
  isEqual,
  key,
  type Day as CalendarDay,
} from './dates';
import { nextFocus, type FocusOptions } from './focus';
import {
  Selection,
  none,
  picking,
  selectDay,
  cancelSelection,
  type SelectionOptions,
} from './selection';
export type Orientation = 'auto' | 'horizontal' | 'vertical';
export interface Options extends SelectionOptions, FocusOptions {
  readonly numberOfMonths?: 1 | 2;
  readonly orientation?: Orientation;
  readonly controlled?: boolean;
  readonly selected?: Selection;
  /** A supplied month is controlled; init.month seeds the local month. */
  readonly month?: CalendarDay;
  readonly disableNavigation?: boolean;
  readonly hideNavigation?: boolean;
  readonly pagedNavigation?: boolean;
  readonly reverseMonths?: boolean;
}
export const Model = Schema.Struct({
  id: Schema.String,
  month: Day,
  today: Day,
  selection: Selection,
  beforePick: Selection,
  focused: Schema.Option(Day),
  hovered: Schema.Option(Day),
  keyboard: Schema.Boolean,
  hasFocus: Schema.Boolean,
  layout: Schema.Literals(['horizontal', 'vertical']),
  committedEnd: Schema.Option(Day),
  commitGeneration: Schema.Number,
  previousTooltip: Tooltip.Model,
  nextTooltip: Tooltip.Model,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  PressedDay: { date: Day },
  Hovered: { date: Schema.Option(Day) },
  Focused: { date: Day, keyboard: Schema.Boolean },
  Left: {},
  PointerInput: {},
  GridKey: { date: Day, key: Schema.String, shift: Schema.Boolean },
  Cancel: {},
  Navigate: { direction: Schema.Literals([-1, 1]) },
  LayoutChanged: { layout: Schema.Literals(['horizontal', 'vertical']) },
  ClearCommitted: { generation: Schema.Number },
  FocusCompleted: {},
  Tooltip: { direction: Schema.Literals([-1, 1]), message: Tooltip.Message },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Selected: { selection: Selection },
  MonthChanged: { month: Day },
});
export type OutMessage = typeof OutMessage.Type;
/** DayPicker clamps the initial first month so the requested view fits the bounds. */
function initialMonth(
  month: CalendarDay,
  options: Pick<Options, 'startMonth' | 'endMonth' | 'numberOfMonths'>,
): CalendarDay {
  let value = firstOfMonth(month);
  if (
    options.endMonth &&
    compare(addMonths(value, (options.numberOfMonths ?? 1) - 1), firstOfMonth(options.endMonth)) > 0
  )
    value = addMonths(firstOfMonth(options.endMonth), 1 - (options.numberOfMonths ?? 1));
  if (options.startMonth && compare(value, firstOfMonth(options.startMonth)) < 0)
    value = firstOfMonth(options.startMonth);
  return value;
}
export const init = (options: {
  readonly id: string;
  readonly today: CalendarDay;
  readonly month?: CalendarDay;
  readonly selected?: Selection;
  readonly startMonth?: CalendarDay;
  readonly endMonth?: CalendarDay;
  readonly numberOfMonths?: 1 | 2;
}): Model => ({
  id: options.id,
  today: options.today,
  month: initialMonth(options.month ?? options.today, options),
  selection: options.selected ?? none(),
  beforePick: none(),
  focused: Option.none(),
  hovered: Option.none(),
  keyboard: false,
  hasFocus: false,
  layout: 'horizontal',
  committedEnd: Option.none(),
  commitGeneration: 0,
  previousTooltip: Tooltip.init({ id: `${options.id}-previous-tooltip` }),
  nextTooltip: Tooltip.init({ id: `${options.id}-next-tooltip` }),
});
export const selection = (model: Model, options: Options): Selection =>
  options.controlled ? (options.selected ?? none()) : model.selection;
export function viewMonth(model: Model, options: Options): CalendarDay {
  let month = firstOfMonth(options.month ?? model.month);
  if (
    options.month &&
    options.endMonth &&
    compare(addMonths(month, (options.numberOfMonths ?? 1) - 1), firstOfMonth(options.endMonth)) > 0
  )
    month = addMonths(firstOfMonth(options.endMonth), 1 - (options.numberOfMonths ?? 1));
  if (options.startMonth && compare(month, firstOfMonth(options.startMonth)) < 0)
    month = firstOfMonth(options.startMonth);
  return month;
}
export function visibleMonths(model: Model, options: Options): readonly CalendarDay[] {
  const first = viewMonth(model, options);
  const months = Array.from({ length: options.numberOfMonths ?? 1 }, (_, index) =>
    addMonths(first, index),
  ).filter((month) => !options.endMonth || compare(month, firstOfMonth(options.endMonth)) <= 0);
  return options.reverseMonths ? [...months].reverse() : months;
}
export function navigationTarget(
  model: Model,
  options: Options,
  direction: -1 | 1,
): CalendarDay | undefined {
  if (options.disableNavigation) return;
  const month = viewMonth(model, options),
    count = options.numberOfMonths ?? 1;
  if (direction < 0 && options.startMonth && compare(month, firstOfMonth(options.startMonth)) <= 0)
    return;
  if (
    direction > 0 &&
    options.endMonth &&
    compare(addMonths(month, count), firstOfMonth(options.endMonth)) > 0
  )
    return;
  let target = addMonths(month, direction * (options.pagedNavigation ? count : 1));
  if (options.startMonth && compare(target, firstOfMonth(options.startMonth)) < 0)
    target = firstOfMonth(options.startMonth);
  if (options.endMonth && compare(target, firstOfMonth(options.endMonth)) > 0)
    target = firstOfMonth(options.endMonth);
  return target;
}
export const dayId = (id: string, date: CalendarDay): string => `${id}-day-${key(date)}`;
export const FocusDay = Command.define('Calendar.FocusDay', {
  args: { id: Schema.String, date: Day },
  messages: [Message.FocusCompleted],
  execute: ({ id, date }) =>
    Dom.focus(`#${CSS.escape(dayId(id, date))}`).pipe(
      Effect.catch(() => Effect.void),
      Effect.as(Message.FocusCompleted()),
    ),
});
const ClearCommitted = Command.define('Calendar.ClearCommittedEnd', {
  args: { generation: Schema.Number },
  messages: [Message.ClearCommitted],
  execute: ({ generation }) =>
    Effect.sleep('220 millis').pipe(Effect.as(Message.ClearCommitted({ generation }))),
});
function select(
  model: Model,
  next: Selection,
  options: Options,
  beforePick = model.beforePick,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  const current = selection(model, options),
    hover = Option.getOrUndefined(model.hovered);
  const committed =
    picking(current) &&
    next._tag === 'Range' &&
    Option.isSome(next.to) &&
    hover &&
    (isEqual(next.to.value, hover) || (Option.isSome(next.from) && isEqual(next.from.value, hover)))
      ? Option.some(hover)
      : Option.none<CalendarDay>();
  const generation = model.commitGeneration + 1;
  return {
    model: {
      ...model,
      selection: options.controlled ? model.selection : next,
      beforePick,
      committedEnd: committed,
      commitGeneration: generation,
    },
    outMessage: OutMessage.Selected({ selection: next }),
    commands: Option.isSome(committed) ? [ClearCommitted({ generation })] : [],
  };
}
export function update(
  model: Model,
  message: Message,
  options: Options = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  switch (message._tag) {
    case 'FocusCompleted':
      return { model };
    case 'ClearCommitted':
      return {
        model:
          message.generation === model.commitGeneration
            ? { ...model, committedEnd: Option.none() }
            : model,
      };
    case 'LayoutChanged':
      return {
        model: model.layout === message.layout ? model : { ...model, layout: message.layout },
      };
    case 'PointerInput':
      return { model: model.keyboard ? { ...model, keyboard: false } : model };
    case 'Left':
      return { model: { ...model, hovered: Option.none(), hasFocus: false, keyboard: false } };
    case 'Hovered':
      return {
        model: Option.makeEquivalence<CalendarDay>(isEqual)(model.hovered, message.date)
          ? model
          : { ...model, hovered: message.date },
      };
    case 'Focused':
      return {
        model: {
          ...model,
          focused: Option.some(message.date),
          hovered: Option.some(message.date),
          hasFocus: true,
          keyboard: message.keyboard,
        },
      };
    case 'PressedDay': {
      const current = { selection: selection(model, options), beforePick: model.beforePick },
        result = selectDay(current, message.date, options);
      return result === current
        ? { model }
        : select(
            { ...model, focused: Option.some(message.date) },
            result.selection,
            options,
            result.beforePick,
          );
    }
    case 'Cancel': {
      const current = { selection: selection(model, options), beforePick: model.beforePick },
        result = cancelSelection(current);
      return result === current
        ? { model }
        : select({ ...model, hovered: Option.none() }, result.selection, options);
    }
    case 'Navigate': {
      const target = navigationTarget(model, options, message.direction);
      if (!target) return { model };
      return {
        model: {
          ...model,
          month: options.month ? model.month : target,
          hovered: Option.none(),
          committedEnd: Option.none(),
        },
        outMessage: OutMessage.MonthChanged({ month: target }),
      };
    }
    case 'GridKey': {
      if (message.key === 'Escape') return update(model, Message.Cancel(), options);
      const target = nextFocus(message.date, message.key, { ...options, shift: message.shift });
      if (!target) return { model };
      const months = visibleMonths(model, options),
        inView = months.some((month) => month.year === target.year && month.month === target.month);
      const changeMonth = !inView && !options.disableNavigation;
      let month = firstOfMonth(target);
      if (options.startMonth && compare(month, firstOfMonth(options.startMonth)) < 0)
        month = firstOfMonth(options.startMonth);
      if (options.endMonth && compare(month, firstOfMonth(options.endMonth)) > 0)
        month = firstOfMonth(options.endMonth);
      return {
        model: {
          ...model,
          month: changeMonth && !options.month ? month : model.month,
          focused: Option.some(target),
          hovered: Option.some(target),
          keyboard: true,
          hasFocus: true,
        },
        commands: [FocusDay({ id: model.id, date: target })],
        ...(changeMonth ? { outMessage: OutMessage.MonthChanged({ month }) } : {}),
      };
    }
    case 'Tooltip': {
      const field = message.direction < 0 ? 'previousTooltip' : 'nextTooltip',
        result = Tooltip.update(model[field], message.message);
      return {
        model: { ...model, [field]: result.model },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message_) =>
            Message.Tooltip({ direction: message.direction, message: message_ }),
          ),
        ),
      };
    }
  }
}
