import { Effect, Option, Schema } from 'effect';
import { Menu } from '@foldkit/ui';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as Slider from '../slider';
import * as Dropdown from '../dropdown';
import { accepts as acceptsMenuMessage } from '../dropdown/state';
import * as Tooltip from '../tooltip';
import {
  buildParsed,
  clamp01,
  formats,
  hslToRgb,
  hsvToRgb,
  oklchToRgb,
  parseColor,
  resolveCssColor,
  rgbToHsl,
  rgbToHsv,
  rgbToOklch,
  type ColorFormat,
  type ParsedColor,
} from './color';

/** Upstream's default starting color (the fluid accent). */
export const defaultColor = '#6B97FF';

export const Format = Schema.Literals(formats);
export const Model = Schema.Struct({
  id: Schema.String,
  /** Stable memo slot; physical ids may change when a popover panel remounts. */
  cacheKey: Schema.String,
  /** HSV + alpha, canonical. H survives S = 0 / V = 0. */
  h: Schema.Number,
  s: Schema.Number,
  v: Schema.Number,
  a: Schema.Number,
  /** The sticky OKLCH hue: the stated OKLCH H across lossy round-trips and
   * achromatic colors; cleared when the hue moves through another channel. */
  oklchHue: Schema.NullOr(Schema.Number),
  format: Format,
  /** The string this panel last emitted, so an echoed controlled value is
   * not re-parsed. */
  lastEmitted: Schema.String,
  hue: Slider.Model,
  alpha: Slider.Model,
  formatMenu: Dropdown.Model,
  /** Upstream's internalOpen survives controlled overrides. */
  formatMenuInternalOpen: Schema.Boolean,
  /** Latest formatOpen prop observed by the panel's Mount. */
  formatMenuControl: Schema.NullOr(Schema.Boolean),
  formatMenuInitialized: Schema.Boolean,
  /** An initially open menu leaves focus with the page until reached. */
  tooltips: Schema.Record(Schema.String, Tooltip.Model),
  swatchTooltips: Tooltip.Group.Model,
  channelTooltips: Tooltip.Group.Model,
  /** window.EyeDropper exists (Chromium); detected after mount. */
  eyedropper: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}

export const channels = [
  'hex',
  'r',
  'g',
  'b',
  'hSL',
  'sSL',
  'lSL',
  'L',
  'C',
  'H',
  'alphaPercent',
] as const;
export type Channel = (typeof channels)[number];

export const Message = defineMessageUnion({
  /** The square's pointer, mapped straight to S and V. */
  SquareMoved: { s: Schema.Number, v: Schema.Number },
  /** Arrows nudge S (left/right) and V (up/down) by 0.01, Shift by 0.1. */
  SquareNudged: { ds: Schema.Number, dv: Schema.Number },
  Hue: { message: Slider.Message },
  Alpha: { message: Slider.Message },
  FormatMenu: {
    message: Dropdown.Message,
    open: Schema.optionalKey(Schema.NullOr(Schema.Boolean)),
  },
  FormatOpenChanged: { open: Schema.NullOr(Schema.Boolean) },
  /** A direct format request, also available to custom controls. */
  FormatPicked: { format: Format },
  /** A channel field's committed text (blur, Enter, nudge or scrub). */
  ChannelCommitted: { channel: Schema.Literals(channels), value: Schema.String },
  SwatchPicked: { color: Schema.String },
  EyedropperRequested: {},
  EyedropperCancelled: {},
  EyedropperPicked: {
    hex: Schema.String,
    requestedHue: Schema.optionalKey(Schema.Number),
    requestedFormat: Schema.optionalKey(Format),
  },
  EyedropperDetected: {},
  Tip: { key: Schema.String, message: Tooltip.Message },
  SwatchTip: { message: Tooltip.Group.Message },
  ChannelTip: { message: Tooltip.Group.Message },
});
export type Message = typeof Message.Type;

export const Parsed = Schema.Struct({
  h: Schema.Number,
  s: Schema.Number,
  v: Schema.Number,
  a: Schema.Number,
  r: Schema.Number,
  g: Schema.Number,
  b: Schema.Number,
  hex: Schema.String,
  rgb: Schema.String,
  hsl: Schema.String,
  oklch: Schema.String,
});
export const OutMessage = defineMessageUnion({
  /** The color in the current format, plus every format. Switching format
   * is reported by FormatChanged together with its value callback. */
  ValueChanged: { value: Schema.String, parsed: Parsed },
  /** Format request together with its reformatted value notification. */
  FormatChanged: { format: Format, value: Schema.String, parsed: Parsed },
});
export type OutMessage = typeof OutMessage.Type;

export interface InitConfig {
  readonly id: string;
  /** Hex, rgb(a), hsl(a) or oklch; unparseable starts at pure red. */
  readonly value?: string;
  /** Initial internal format, matching upstream defaultFormat. */
  readonly defaultFormat?: ColorFormat;
  /** Initial internal format-menu state, matching upstream defaultFormatOpen. */
  readonly defaultFormatOpen?: boolean;
  /** Starting-format alias. Controlled format belongs to Options/Props.
   * @deprecated Use defaultFormat for the initial internal format. */
  readonly format?: ColorFormat;
}
const hsvOf = (value: string) => {
  const parsed = parseColor(value);
  if (!parsed) return { h: 0, s: 1, v: 1, a: 1 };
  const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
  return { h: hsv.s === 0 ? 0 : hsv.h, s: hsv.s, v: hsv.v, a: parsed.a };
};
export const init = (config: InitConfig): Model => ({
  id: config.id,
  cacheKey: config.id,
  ...hsvOf(config.value ?? defaultColor),
  oklchHue: null,
  format: config.defaultFormat ?? config.format ?? 'hex',
  lastEmitted: '',
  hue: Slider.init({ id: `${config.id}-hue`, min: 0, max: 360, step: 1 }),
  alpha: Slider.init({ id: `${config.id}-alpha`, min: 0, max: 100, step: 1 }),
  formatMenu: Dropdown.init({ id: `${config.id}-format` }),
  formatMenuInternalOpen: config.defaultFormatOpen ?? false,
  formatMenuControl: null,
  formatMenuInitialized: false,
  tooltips: {},
  channelTooltips: Tooltip.Group.init({ id: `${config.id}-channels`, delayDuration: 300 }),
  swatchTooltips: Tooltip.Group.init({
    id: `${config.id}-swatches`,
    delayDuration: 300,
  }),
  eyedropper: false,
});

export const parsedOf = (model: Model): ParsedColor =>
  buildParsed(model.h, model.s, model.v, model.a);

/** A controlled value arriving from outside: re-derive HSV unless it is the
 * panel's own emitted string coming back. A gray keeps the held hue. */
export function syncValue(model: Model, value: string): Model {
  if (value === model.lastEmitted) return model;
  const parsed = parseColor(value);
  if (!parsed) return model;
  // A controlled owner may normalize the emitted string (for example,
  // uppercase hex). Preserve canonical HSV when it echoes the same colour;
  // converting rounded RGB back to HSV on every drag introduces drift.
  if (model.lastEmitted) {
    const emitted = parseColor(model.lastEmitted);
    if (
      emitted &&
      parsed.r === emitted.r &&
      parsed.g === emitted.g &&
      parsed.b === emitted.b &&
      parsed.a === emitted.a
    )
      return model;
    const rgb = hsvToRgb(model.h, model.s, model.v);
    if (
      parsed.r === Math.round(rgb.r) &&
      parsed.g === Math.round(rgb.g) &&
      parsed.b === Math.round(rgb.b) &&
      parsed.a === model.a
    )
      return model;
  }
  const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
  return {
    ...model,
    oklchHue: null,
    h: hsv.s === 0 ? model.h : hsv.h,
    s: hsv.s,
    v: hsv.v,
    a: parsed.a,
    lastEmitted: value,
  };
}

type Return = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
/** Switching format re-emits the same color in the new format. */
function switchFormat(model: Model, format: ColorFormat): Return {
  const parsed = parsedOf(model);
  return {
    model: { ...model, format, lastEmitted: parsed[format] },
    outMessage: OutMessage.FormatChanged({ format, value: parsed[format], parsed }),
  };
}
/** The write path: merge into HSV, format in the current format, record it
 * as emitted, then notify. */
function emit(model: Model, next: Partial<Pick<Model, 'h' | 's' | 'v' | 'a'>>): Return {
  const merged = { ...model, ...next };
  const parsed = parsedOf(merged);
  const value = parsed[merged.format];
  return {
    model: { ...merged, lastEmitted: value },
    outMessage: OutMessage.ValueChanged({ value, parsed }),
  };
}
/** Hex field, swatches and eyedropper: a whole color. Unreadable strings are
 * dropped; a gray keeps the held hue. */
function commitColor(model: Model, input: string): Return {
  const parsed = resolveCssColor(input);
  if (!parsed) return { model };
  const hsv = rgbToHsv(parsed.r, parsed.g, parsed.b);
  return emit(
    { ...model, oklchHue: null },
    { h: hsv.s === 0 ? model.h : hsv.h, s: hsv.s, v: hsv.v, a: parsed.a },
  );
}

/** Each channel field's bounds and steps, as upstream's ColorInputsRow. */
export interface ChannelSpec {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly shiftStep: number;
  readonly decimals?: number;
  readonly percent?: boolean;
  readonly wrap?: boolean;
}
const byte = { min: 0, max: 255, step: 1, shiftStep: 10 },
  percent = { min: 0, max: 100, step: 1, shiftStep: 10 },
  angle = { min: 0, max: 360, step: 1, shiftStep: 10, wrap: true };
export const channelSpecs: Record<Exclude<Channel, 'hex'>, ChannelSpec> = {
  r: byte,
  g: byte,
  b: byte,
  hSL: angle,
  sSL: percent,
  lSL: percent,
  L: percent,
  C: { min: 0, max: 0.4, step: 0.01, shiftStep: 0.1, decimals: 2 },
  H: angle,
  alphaPercent: { ...percent, percent: true },
};
/** Clamp (or wrap, for hues) a typed number to its field. */
export function boundChannel(spec: ChannelSpec, n: number): number {
  if (spec.wrap) {
    if (n < spec.min || n > spec.max) {
      const range = spec.max - spec.min;
      return ((((n - spec.min) % range) + range) % range) + spec.min;
    }
    return n;
  }
  return Math.min(spec.max, Math.max(spec.min, n));
}

const toRgbHsv = (model: Model, rgb: { r: number; g: number; b: number }, heldHue: number) => {
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  return { h: hsv.s === 0 ? heldHue : hsv.h, s: hsv.s, v: hsv.v } satisfies Partial<Model>;
};
function commitChannel(model: Model, channel: Channel, raw: string): Return {
  if (channel === 'hex') return commitColor(model, raw.startsWith('#') ? raw : `#${raw}`);
  const spec = channelSpecs[channel];
  const typed = parseFloat(raw.replace('%', ''));
  if (Number.isNaN(typed)) return { model };
  const bounded = boundChannel(spec, typed);
  const n =
    spec.decimals === undefined ? Math.round(bounded) : Number(bounded.toFixed(spec.decimals));
  const p = parsedOf(model);
  switch (channel) {
    case 'r':
    case 'g':
    case 'b':
      return emit(
        { ...model, oklchHue: null },
        toRgbHsv(
          model,
          {
            r: channel === 'r' ? n : p.r,
            g: channel === 'g' ? n : p.g,
            b: channel === 'b' ? n : p.b,
          },
          model.h,
        ),
      );
    case 'hSL':
    case 'sSL':
    case 'lSL': {
      const hsl = rgbToHsl(p.r, p.g, p.b);
      const h = channel === 'hSL' ? n : hsl.h;
      const rgb = hslToRgb(
        h,
        clamp01(channel === 'sSL' ? n / 100 : hsl.s),
        clamp01(channel === 'lSL' ? n / 100 : hsl.l),
      );
      // On a gray, a typed HSL hue still becomes the held HSV hue.
      return emit(
        channel === 'hSL' ? { ...model, oklchHue: null } : model,
        toRgbHsv(model, rgb, h),
      );
    }
    case 'L':
    case 'C':
    case 'H': {
      const current = rgbToOklch(p.r, p.g, p.b);
      const L = channel === 'L' ? n / 100 : current.L;
      const C = channel === 'C' ? n : current.C;
      const H = channel === 'H' ? n : (model.oklchHue ?? current.H);
      // Any OKLCH edit makes H sticky.
      return emit(
        { ...model, oklchHue: H },
        toRgbHsv(model, oklchToRgb(clamp01(L), Math.max(0, C), H), model.h),
      );
    }
    case 'alphaPercent':
      return emit(model, { a: clamp01(n / 100) });
  }
}

const EyeDrop = Command.define('ColorPicker.EyeDrop', {
  args: { hue: Schema.Number, format: Format },
  messages: [Message.EyedropperPicked, Message.EyedropperCancelled],
  execute: ({ hue, format }) =>
    Effect.tryPromise(async () => {
      const Ctor = (
        window as unknown as { EyeDropper: new () => { open(): Promise<{ sRGBHex: string }> } }
      ).EyeDropper;
      return Message.EyedropperPicked({
        hex: (await new Ctor().open()).sRGBHex,
        requestedHue: hue,
        requestedFormat: format,
      });
    }).pipe(
      // Escape rejects open(): cancelling a pick is not an error.
      Effect.catch(() => Effect.succeed(Message.EyedropperCancelled())),
    ),
});

const mapCommands = <Inner>(
  commands: Update.Return<unknown, Inner>['commands'],
  wrap: (message: Inner) => Message,
) => (commands ?? []).map((command) => Command.mapMessage(command, wrap));

export interface Options {
  /** Controlled format. Handle FormatChanged, then pass the parent value to view too. */
  readonly format?: ColorFormat;
  /** Controlled menu state. User toggles are ignored; pass the same value to view. */
  readonly formatOpen?: boolean;
  /** A controlled value: when it differs from what the panel last emitted,
   * the panel re-derives its color from it before handling the message. */
  readonly value?: string;
}

/** Prop changes use the same animated menu lifetime as user opens/closes.
 * Keep the uncontrolled value separate: releasing control restores it. */
function syncFormatOpen(model: Model, control: boolean | null): Return {
  const open = control ?? model.formatMenuInternalOpen;
  const initial = !model.formatMenuInitialized;
  if (!initial && control === model.formatMenuControl && open === model.formatMenu.isOpen)
    return { model };
  const result = Dropdown.update(
    model.formatMenu,
    open
      ? Dropdown.Message.Opened({ maybeActiveItemIndex: Option.none() })
      : Dropdown.Message.Closed(),
  );
  return {
    model: {
      ...model,
      formatMenu: result.model,
      formatMenuControl: control,
      formatMenuInitialized: true,
    },
    commands: mapCommands(result.commands, (message) => Message.FormatMenu({ message })),
  };
}

export function update(stored: Model, message: Message, options: Options = {}): Return {
  const base = options.value === undefined ? stored : syncValue(stored, options.value);
  if (options.format === undefined) return updateInternal(base, message, options);
  const model = base.format === options.format ? base : { ...base, format: options.format };
  const result = updateInternal(model, message, options);
  return {
    ...result,
    model: result.model === model ? base : { ...result.model, format: base.format },
  };
}
function updateInternal(model: Model, message: Message, options: Options): Return {
  switch (message._tag) {
    case 'SquareMoved':
      return emit(model, { s: clamp01(message.s), v: clamp01(message.v) });
    case 'SquareNudged':
      return emit(model, { s: clamp01(model.s + message.ds), v: clamp01(model.v + message.dv) });
    case 'Hue':
    case 'Alpha': {
      const key = message._tag === 'Hue' ? 'hue' : 'alpha';
      const result = Slider.update(model[key], message.message);
      const next = { ...model, [key]: result.model };
      const wrap = (inner: Slider.Message) =>
        key === 'hue' ? Message.Hue({ message: inner }) : Message.Alpha({ message: inner });
      const commands = mapCommands(result.commands, wrap);
      const out = result.outMessage;
      if (out?._tag !== 'ChangedValue') return { model: next, commands };
      // A hue picked on the rail is a new stated hue: the sticky OKLCH hue goes.
      const emitted =
        key === 'hue'
          ? emit({ ...next, oklchHue: null }, { h: out.value })
          : emit(next, { a: out.value / 100 });
      return { ...emitted, commands };
    }
    case 'FormatMenu': {
      if (!acceptsMenuMessage(model.formatMenu, message.message)) return { model };
      const control =
        message.open !== undefined
          ? message.open
          : 'formatOpen' in options
            ? (options.formatOpen ?? null)
            : model.formatMenuControl;
      const synchronized = syncFormatOpen(model, control);
      model = synchronized.model;
      const input = message.message._tag === 'Scoped' ? message.message.message : message.message;
      const result = Dropdown.update(model.formatMenu, message.message);
      if (input._tag === 'Unmounted')
        return { model: { ...model, formatMenu: result.model, formatMenuInitialized: false } };
      const rejected = control !== null && result.model.isOpen !== model.formatMenu.isOpen;
      const menu = rejected
        ? {
            ...model.formatMenu,
            ...(input._tag === 'PressedPointerOnButton' || input._tag === 'ClickedButton'
              ? { maybeLastButtonPointerType: result.model.maybeLastButtonPointerType }
              : {}),
          }
        : result.model;
      const next = {
        ...model,
        formatMenu: menu,
        formatMenuInternalOpen: control === null ? menu.isOpen : model.formatMenuInternalOpen,
      };
      const commands = [
        ...(synchronized.commands ?? []),
        ...mapCommands(rejected ? [] : result.commands, (inner) =>
          Message.FormatMenu({ message: inner }),
        ),
      ];
      const out = result.outMessage;
      if (out?._tag !== 'Selected') return { model: next, commands };
      return { ...switchFormat(next, out.value as ColorFormat), commands };
    }
    case 'FormatOpenChanged':
      return syncFormatOpen(model, message.open);
    case 'FormatPicked':
      return switchFormat(model, message.format);
    case 'ChannelCommitted':
      return commitChannel(model, message.channel, message.value);
    case 'SwatchPicked':
      return commitColor(model, message.color);
    case 'EyedropperPicked': {
      const result = commitColor(
        {
          ...model,
          h: message.requestedHue ?? model.h,
          format: message.requestedFormat ?? model.format,
        },
        message.hex,
      );
      if (!result.outMessage) return { model };
      return { ...result, model: { ...result.model, format: model.format } };
    }
    case 'EyedropperCancelled':
      return { model };
    case 'EyedropperRequested':
      return { model, commands: [EyeDrop({ hue: model.h, format: model.format })] };
    case 'EyedropperDetected':
      return { model: model.eyedropper ? model : { ...model, eyedropper: true } };
    case 'ChannelTip': {
      const result = Tooltip.Group.update(model.channelTooltips, message.message);
      return {
        model: { ...model, channelTooltips: result.model },
        commands: mapCommands(result.commands, (message) => Message.ChannelTip({ message })),
      };
    }
    case 'SwatchTip': {
      const result = Tooltip.Group.update(model.swatchTooltips, message.message);
      return {
        model: { ...model, swatchTooltips: result.model },
        commands: mapCommands(result.commands, (message) => Message.SwatchTip({ message })),
      };
    }
    case 'Tip': {
      const result = Tooltip.update(
        model.tooltips[message.key] ?? tipInit(model, message.key),
        message.message,
      );
      return {
        model: { ...model, tooltips: { ...model.tooltips, [message.key]: result.model } },
        commands: mapCommands(result.commands, (inner) =>
          Message.Tip({ key: message.key, message: inner }),
        ),
      };
    }
  }
}
export const tipInit = (model: Pick<Model, 'id'>, key: string) =>
  Tooltip.init({ id: `${model.id}-tip-${key}`, showDelay: '300 millis' });

/** The current color at full opacity: the alpha rail's thumb and opaque end. */
export function solidRgb(model: Model) {
  const { r, g, b } = hsvToRgb(model.h, model.s, model.v);
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}
