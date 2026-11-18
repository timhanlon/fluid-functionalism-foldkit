import { defineSilentMount } from '../silent-mount';
import { shapeRadius } from '../shape';
import { Popover } from '@foldkit/ui';
import { Effect, Schema } from 'effect';
import { Command, Submodel, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { Html } from 'foldkit/html';
import { mountHover } from '../../fluid-hover/engine';
import { icon } from '../icons';
import { parseColor, rgbToHexStr } from './color';
import * as Picker from './state';
import { view as pickerView, type Props as PickerProps } from './panel';
import { tile } from './tile';

export const Model = Schema.Struct({
  id: Schema.String,
  popover: Popover.Model,
  picker: Picker.Model,
  /** The popover owns the value, since the trigger shows it too. */
  value: Schema.String,
  initialValue: Schema.String,
  initialFormat: Picker.Format,
  initialFormatOpen: Schema.Boolean,
  generation: Schema.Number,
  panelGeneration: Schema.Number,
  panelReady: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Popover: { message: Popover.Message, generation: Schema.optionalKey(Schema.Number) },
  Picker: {
    message: Picker.Message,
    generation: Schema.optionalKey(Schema.Number),
    panelGeneration: Schema.optionalKey(Schema.Number),
  },
  RemovePressed: {},
  RemoveFromInstance: { generation: Schema.Number },
  Unmounted: { generation: Schema.Number },
  PanelUnmounted: { generation: Schema.Number, panelGeneration: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  ValueChanged: { value: Schema.String, parsed: Picker.Parsed },
  FormatChanged: { format: Picker.Format, value: Schema.String, parsed: Picker.Parsed },
  Removed: {},
  OpenChanged: { open: Schema.Boolean },
});
export type OutMessage = typeof OutMessage.Type;

export const init = (config: Picker.InitConfig): Model => ({
  id: config.id,
  initialValue: config.value ?? Picker.defaultColor,
  initialFormat: config.defaultFormat ?? config.format ?? 'hex',
  initialFormatOpen: config.defaultFormatOpen ?? false,
  generation: 0,
  panelGeneration: 0,
  panelReady: false,
  popover: Popover.init({
    id: `${config.id}-popover`,
    isAnimated: true,
    isModal: false,
    contentFocus: true,
  }),
  picker: Picker.init({ ...config, id: `${config.id}-panel` }),
  value: config.value ?? Picker.defaultColor,
});
/** A remounted panel gets fresh internal ids so queued DOM Commands cannot
 * reach a replacement that happens to have the same public owner id. */
const freshPanel = (model: Model, value: string, generation: number): Picker.Model => ({
  ...Picker.init({
    id: generation === 0 ? `${model.id}-panel` : `${model.id}-panel-${generation}`,
    value,
    defaultFormat: model.initialFormat,
    defaultFormatOpen: model.initialFormatOpen,
  }),
  cacheKey: `${model.id}-panel`,
});
/** Use when the complete trigger owner is removed/recreated. */
export function reset(model: Model, value = model.initialValue): Model {
  const generation = model.generation + 1,
    panelGeneration = model.panelGeneration + 1;
  const fresh = init({
    id: model.id,
    value,
    defaultFormat: model.initialFormat,
    defaultFormatOpen: model.initialFormatOpen,
  });
  return {
    ...fresh,
    generation,
    panelGeneration,
    popover: Popover.init({
      id: `${model.id}-popover-${generation}`,
      isAnimated: true,
      isModal: false,
      contentFocus: true,
    }),
    picker: freshPanel(model, value, panelGeneration),
  };
}
/** A value set from outside (a controlled parent). */
export const syncValue = (model: Model, value: string): Model =>
  value === model.value
    ? model
    : { ...model, value, picker: Picker.syncValue(model.picker, value) };

export function update(
  model: Model,
  message: Message,
  options: Picker.Options = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (options.value !== undefined) model = syncValue(model, options.value);
  const staleOwner =
    'generation' in message &&
    message.generation !== undefined &&
    message.generation !== model.generation;
  const stalePanel =
    message._tag === 'Picker' &&
    message.panelGeneration !== undefined &&
    message.panelGeneration !== model.panelGeneration;
  if (staleOwner || stalePanel) {
    // Source EyeDropper promises still invoke the old onValueChange closure.
    // Keep that callback while refusing to restore the removed panel state.
    if (message._tag !== 'Picker' || message.message._tag !== 'EyedropperPicked') return { model };
    const result = Picker.update(
      freshPanel(model, model.value, model.panelGeneration),
      message.message,
    );
    const out = result.outMessage;
    if (out?._tag !== 'ValueChanged') return { model };
    return {
      model: staleOwner
        ? model
        : {
            ...model,
            value: out.value,
            picker:
              model.popover.isOpen || model.popover.animation.isShowing
                ? Picker.syncValue(model.picker, out.value)
                : freshPanel(model, out.value, model.panelGeneration),
          },
      outMessage: OutMessage.ValueChanged({ value: out.value, parsed: out.parsed }),
    };
  }
  switch (message._tag) {
    case 'Unmounted':
      return { model: reset(model) };
    case 'PanelUnmounted': {
      if (message.panelGeneration !== model.panelGeneration) return { model };
      const panelGeneration = model.panelGeneration + 1;
      return {
        model: {
          ...model,
          panelGeneration,
          panelReady: false,
          picker: freshPanel(model, model.value, panelGeneration),
        },
      };
    }
    case 'Popover': {
      const result = Popover.update(model.popover, message.message);
      return {
        model: {
          ...model,
          popover: result.model,
          ...(!model.panelReady && result.model.isOpen
            ? {
                panelReady: true,
                picker: freshPanel(model, model.value, model.panelGeneration),
              }
            : {}),
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (inner) =>
            Message.Popover({ message: inner, generation: model.generation }),
          ),
        ),
        ...(result.outMessage
          ? { outMessage: OutMessage.OpenChanged({ open: result.outMessage._tag === 'Opened' }) }
          : {}),
      };
    }
    case 'Picker': {
      const result = Picker.update(model.picker, message.message, {
        format: options.format,
        ...('formatOpen' in options ? { formatOpen: options.formatOpen } : {}),
      });
      const out = result.outMessage;
      return {
        model: {
          ...model,
          picker: result.model,
          value: out ? out.value : model.value,
        },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (inner) =>
            Message.Picker({
              message: inner,
              generation: model.generation,
              panelGeneration: model.panelGeneration,
            }),
          ),
        ),
        ...(out
          ? {
              outMessage:
                out._tag === 'FormatChanged'
                  ? OutMessage.FormatChanged({
                      format: out.format,
                      value: out.value,
                      parsed: out.parsed,
                    })
                  : OutMessage.ValueChanged({ value: out.value, parsed: out.parsed }),
            }
          : {}),
      };
    }
    case 'RemoveFromInstance':
    case 'RemovePressed':
      return { model, outMessage: OutMessage.Removed() };
  }
}

export interface Props extends Omit<PickerProps, 'surface' | 'portalMenu'> {
  readonly triggerLabel?: string;
  readonly triggerLabelPosition?: 'left' | 'right';
  /** The color as 6-digit hex beside the tile (alpha left out). Default true. */
  readonly triggerShowValue?: boolean;
  /** An X inside the trigger that emits Removed without opening. */
  readonly triggerShowRemove?: boolean;
  readonly triggerClassName?: string;
  /** Extra trigger content after the color (the right panel's shortcut). */
  readonly triggerTrailing?: readonly Html[];
  /** The surface the trigger sits on; the panel floats two levels above. */
  readonly surfaceLevel?: number;
}

/** One fluid hover across the open segment and the remove X. */
const SegmentsMounted = defineSilentMount('ColorPicker.TriggerSegments', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const hover = mountHover(element, {
          itemSelector: '.ff-cp-segment',
          axis: 'x',
          radius: () => `${shapeRadius(element.dataset.radius, 5, 17, 0)}px`,
        });
        return () => hover.dispose();
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});

/** Upstream's ColorPickerPopover: a tile + hex trigger (optionally a
 * two-segment field with a remove X) opening the panel two surface levels
 * up, its format menu rendered inside the panel. */
export const view = Submodel.defineView<Model, Message, Props>((stored, props, h) => {
  // A controlled value (props.value) re-derives the color, as update does.
  const model = props.value === undefined ? stored : syncValue(stored, props.value);
  const compact = props.size === 'compact';
  const parsed = parseColor(model.value);
  const tileColor = parsed ? rgbToHexStr(parsed.r, parsed.g, parsed.b, parsed.a) : model.value;
  const valueLabel = parsed
    ? rgbToHexStr(parsed.r, parsed.g, parsed.b, 1).replace(/^#/, '').toUpperCase()
    : model.value;
  const level = Math.min((props.surfaceLevel ?? 3) + 2, 8);
  const label = (side: 'left' | 'right') =>
    props.triggerLabel && (props.triggerLabelPosition ?? 'left') === side
      ? h.span([h.Class('ff-cp-trigger-label')], [props.triggerLabel])
      : null;
  const content = [
    label('left'),
    tile({ color: tileColor, size: compact ? 16 : 20, radius: props.radius }, h),
    props.triggerShowValue === false
      ? null
      : h.span([h.Class('ff-cp-trigger-value')], [valueLabel]),
    label('right'),
    ...(props.triggerTrailing ?? []),
  ];
  return h.submodel({
    slotId: 'popover',
    model: model.popover,
    view: Popover.view,
    toParentMessage: (message) => Message.Popover({ message, generation: model.generation }),
    viewInputs: {
      anchor: { placement: 'bottom-start', gap: 6, padding: 5, portal: true },
      focusSelector: '.ff-cp-square',
      toView: (info) =>
        h.div(
          [
            h.Key(`color-picker:${model.id}:${model.generation}`),
            h.OnUnmount(Message.Unmounted({ generation: model.generation })),
            h.Class('ff-cp-popover-root'),
            h.DataAttribute('size', compact ? 'compact' : 'default'),
            h.DataAttribute('radius', props.radius ?? 'rounded'),
          ],
          [
            props.triggerShowRemove
              ? h.div(
                  [
                    h.Class(`ff-cp-trigger-field ${props.triggerClassName ?? ''}`),
                    h.DataAttribute('slot', 'color-picker-trigger-field'),
                    h.DataAttribute('radius', props.radius ?? 'rounded'),
                    h.OnMount(SegmentsMounted()),
                  ],
                  [
                    h.button(
                      [
                        ...info.button,
                        h.AriaHasPopup('dialog'),
                        h.Class('ff-cp-segment ff-cp-segment-open'),
                        h.DataAttribute('open', String(model.popover.isOpen)),
                      ],
                      content,
                    ),
                    h.button(
                      [
                        h.Type('button'),
                        h.Class('ff-cp-segment ff-cp-segment-remove'),
                        h.AriaLabel('Remove color'),
                        h.OnClick(Message.RemoveFromInstance({ generation: model.generation })),
                      ],
                      [
                        h.span(
                          [h.Class('ff-cp-glyph'), h.AriaHidden(true)],
                          [icon('x', props.icons, h)],
                        ),
                      ],
                    ),
                  ],
                )
              : h.button(
                  [
                    ...info.button,
                    h.AriaHasPopup('dialog'),
                    h.Class(`ff-cp-trigger ${props.triggerClassName ?? ''}`),
                    h.DataAttribute('open', String(model.popover.isOpen)),
                  ],
                  content,
                ),
            info.isVisible
              ? h.div(
                  [
                    ...info.panel,
                    h.Role('dialog'),
                    h.AriaLabel(props.triggerLabel || 'Color picker'),
                    h.Class('ff-popup ff-cp-popover'),
                    h.OnUnmount(
                      Message.PanelUnmounted({
                        generation: model.generation,
                        panelGeneration: model.panelGeneration,
                      }),
                    ),
                  ],
                  [
                    h.submodel({
                      slotId: 'panel',
                      model: model.picker,
                      view: pickerView,
                      toParentMessage: (message) =>
                        Message.Picker({
                          message,
                          generation: model.generation,
                          panelGeneration: model.panelGeneration,
                        }),
                      viewInputs: {
                        ...props,
                        value: model.value,
                        surface: `bg-surface-${level} shadow-surface-3`,
                        portalMenu: false,
                      },
                    }),
                  ],
                )
              : null,
          ],
        ),
    },
  });
});
