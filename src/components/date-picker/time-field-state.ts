import { Option, Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { formatTime, nearestSlotIndex, parseTime, type TimeSlot } from './time';
export interface Options {
  readonly value: number | null;
  readonly slots: readonly TimeSlot[];
  readonly fallback: number;
  readonly hourCycle: 12 | 24;
  readonly locale?: string;
  readonly disabled?: boolean;
}
export const Model = Schema.Struct({
  isOpen: Schema.Boolean,
  draft: Schema.Option(Schema.String),
  activeIndex: Schema.Option(Schema.Number),
  /** A new request centers the initial/typed row or follows keyboard movement. */
  scrollGeneration: Schema.Number,
  scrollCenter: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Opened: {},
  Changed: { value: Schema.String },
  Blurred: { insideList: Schema.Boolean },
  Closed: {},
  PressedKey: { key: Schema.String },
  Hovered: { index: Schema.Option(Schema.Number) },
  Picked: { index: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({ Committed: { minutes: Schema.Number } });
export type OutMessage = typeof OutMessage.Type;
export const init = (): Model => ({
  isOpen: false,
  draft: Option.none(),
  activeIndex: Option.none(),
  scrollGeneration: 0,
  scrollCenter: true,
});
export const display = (model: Model, options: Options): string =>
  Option.getOrElse(model.draft, () =>
    options.value === null ? '' : formatTime(options.value, options.hourCycle, options.locale),
  );
export const selectedIndex = (options: Options): number =>
  options.value === null ? -1 : options.slots.findIndex((slot) => slot.minutes === options.value);
export const handlesKey = (model: Model, key: string): boolean =>
  key === 'ArrowDown' ||
  key === 'ArrowUp' ||
  key === 'Enter' ||
  (key === 'Escape' && (model.isOpen || Option.isSome(model.draft)));
const close = (model: Model): Model => ({
  ...model,
  isOpen: false,
  draft: Option.none(),
  activeIndex: Option.none(),
});
function open(model: Model, options: Options): Model {
  if (model.isOpen) return model;
  const selected = selectedIndex(options),
    target = selected >= 0 ? selected : nearestSlotIndex(options.slots, options.fallback);
  return {
    ...model,
    isOpen: true,
    activeIndex: target >= 0 ? Option.some(target) : Option.none(),
    scrollGeneration: model.scrollGeneration + 1,
    scrollCenter: true,
  };
}
function commitDraft(model: Model, options: Options): OutMessage | undefined {
  if (Option.isNone(model.draft)) return;
  const parsed = parseTime(model.draft.value),
    first = options.slots[0];
  const floor = first?.duration === undefined ? -1 : first.minutes - first.duration;
  if (parsed !== null && parsed > floor) return OutMessage.Committed({ minutes: parsed });
}
/** An end slot's duration carries its lower bound. Typed times stay unsnapped
 * but must be later than that bound; invalid blur drops the draft. */
export function update(
  model: Model,
  message: Message,
  options: Options,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (options.disabled) return { model: close(model) };
  switch (message._tag) {
    case 'Opened':
      return { model: open(model, options) };
    case 'Hovered':
      return {
        model: {
          ...model,
          activeIndex: Option.filter(message.index, (index) => !!options.slots[index]),
        },
      };
    case 'Picked': {
      const slot = options.slots[message.index];
      return slot
        ? { model: close(model), outMessage: OutMessage.Committed({ minutes: slot.minutes }) }
        : { model };
    }
    case 'Closed':
      return { model: close(model), outMessage: commitDraft(model, options) };
    case 'Blurred':
      return message.insideList
        ? { model }
        : { model: close(model), outMessage: commitDraft(model, options) };
    case 'Changed': {
      const parsed = parseTime(message.value),
        index = parsed === null ? -1 : nearestSlotIndex(options.slots, parsed);
      return {
        model: {
          ...model,
          isOpen: true,
          draft: Option.some(message.value),
          ...(parsed === null
            ? {}
            : {
                activeIndex: index < 0 ? Option.none() : Option.some(index),
                scrollGeneration: model.scrollGeneration + 1,
                scrollCenter: true,
              }),
        },
      };
    }
    case 'PressedKey': {
      if (message.key === 'Escape') return { model: close(model) };
      if (message.key === 'Enter') {
        if (Option.isSome(model.draft) && parseTime(model.draft.value) !== null)
          return { model: close(model), outMessage: commitDraft(model, options) };
        const slot = options.slots[Option.getOrElse(model.activeIndex, () => -1)];
        return {
          model: close(model),
          ...(slot ? { outMessage: OutMessage.Committed({ minutes: slot.minutes }) } : {}),
        };
      }
      if (message.key !== 'ArrowDown' && message.key !== 'ArrowUp') return { model };
      if (!model.isOpen) return { model: open(model, options) };
      if (!options.slots.length) return { model };
      const index = Math.min(
        Math.max(
          Option.getOrElse(model.activeIndex, () => selectedIndex(options)) +
            (message.key === 'ArrowDown' ? 1 : -1),
          0,
        ),
        options.slots.length - 1,
      );
      return {
        model: {
          ...model,
          activeIndex: Option.some(index),
          draft: Option.some(
            formatTime(options.slots[index]!.minutes, options.hourCycle, options.locale),
          ),
          scrollGeneration: model.scrollGeneration + 1,
          scrollCenter: false,
        },
      };
    }
  }
}
