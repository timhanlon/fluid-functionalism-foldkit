import { shapeClass } from '../shape';
import { Option } from 'effect';
import { Submodel, Subscription } from 'foldkit';
import {
  createKeyedLazy,
  childAttributes,
  type ChildAttribute,
  type Html,
  type HtmlBuilder,
} from 'foldkit/html';
import * as Slider from '../slider';
import * as Dropdown from '../dropdown';
import * as Tooltip from '../tooltip';
import { icon } from '../icons';
import {
  type ColorFormat,
  formatLabels,
  formats,
  parseColor,
  resolveCssColor,
  rgbToHexStr,
  rgbToHsl,
  rgbToOklch,
} from './color';
import {
  Message,
  channelSpecs,
  parsedOf,
  solidRgb,
  syncValue,
  tipInit,
  type Channel,
  type Model,
} from './state';
import { Mounted } from './runtime';
import './styles.css';

/** A swatch for the strip: a CSS color, or one with a name (tooltip and
 * accessible label). */
export type SwatchItem = string | { readonly color: string; readonly label?: string };

export interface Props {
  /** Controlled format; pass the same value to update. Defaults to the internal format. */
  readonly format?: ColorFormat;
  /** Controlled value (see state Options); omitted, the panel owns it. */
  readonly value?: string;
  /** Any CSS colors, named ones included. */
  readonly swatches?: readonly SwatchItem[];
  /** The button already hides itself where window.EyeDropper is missing. */
  readonly hideEyedropper?: boolean;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  /** Surface classes for the panel; the popover lifts it two levels. */
  readonly surface?: string;
  readonly className?: string;
  /** false: the format menu renders inside the panel (in a popover). */
  readonly portalMenu?: boolean;
  /** Outside-click policy for the format menu; defaults to dismiss. */
  readonly formatBackdrop?: Dropdown.Props['backdrop'];
  /** Controlled menu state; user toggles are ignored. Rows still switch format. */
  readonly formatOpen?: boolean;
}

const swatchViews = createKeyedLazy();
const controlViews = createKeyedLazy();

const hueTrack =
  'linear-gradient(to right, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))';
const checker =
  'conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%, var(--checker-a) 0 75%, var(--checker-b) 0)';

/** Upstream's ColorPicker panel: the HSV square at the current hue, hue and
 * alpha rails, the format menu and eyedropper, the channel fields for the
 * format, and an optional swatch strip. One color held as HSV + alpha; every
 * edit emits ValueChanged in the selected format. */
export const view = Submodel.defineView<Model, Message, Props>((stored, props, h) => {
  const base = props.value === undefined ? stored : syncValue(stored, props.value);
  const model =
    props.format === undefined || base.format === props.format
      ? base
      : { ...base, format: props.format };
  const size = props.size ?? 'default';
  const parsed = parsedOf(model);
  const solid = solidRgb(model);
  const solidColor = `rgb(${solid.r}, ${solid.g}, ${solid.b})`;

  const tip = (
    channel: string,
    content: string,
    trigger: (attributes: readonly ChildAttribute[]) => Html,
  ) => {
    const tipProps = { content, radius: props.radius, renderTrigger: trigger };
    // The same three ChannelTooltip positions survive RGB/HSL/OKLCH changes.
    // HEX has no source group; entering it releases the group's native scope.
    if (model.format !== 'hex') {
      const key =
        channel === 'alphaPercent'
          ? 'alpha'
          : ['r', 'hSL', 'L'].includes(channel)
            ? 'first'
            : ['g', 'sSL', 'C'].includes(channel)
              ? 'second'
              : 'third';
      return Tooltip.Group.tip(
        model.channelTooltips,
        key,
        tipProps,
        (message) => Message.ChannelTip({ message }),
        h,
      );
    }
    return h.submodel({
      slotId: `tip-${channel}`,
      model: model.tooltips[channel] ?? tipInit(model, channel),
      view: Tooltip.view,
      toParentMessage: (message) => Message.Tip({ key: channel, message }),
      viewInputs: tipProps,
    });
  };

  const square = h.div(
    [
      h.Class('ff-cp-square'),
      h.Role('application'),
      h.AriaLabel('Saturation and brightness'),
      h.Tabindex(0),
      h.OnKeyDownPreventDefault((key, modifiers) => {
        const step = modifiers.shiftKey ? 0.1 : 0.01;
        const nudge =
          key === 'ArrowLeft'
            ? { ds: -step, dv: 0 }
            : key === 'ArrowRight'
              ? { ds: step, dv: 0 }
              : key === 'ArrowUp'
                ? { ds: 0, dv: step }
                : key === 'ArrowDown'
                  ? { ds: 0, dv: -step }
                  : undefined;
        return nudge ? Option.some(Message.SquareNudged(nudge)) : Option.none();
      }),
    ],
    [
      // Black rising over white → pure hue: the HSV plane for this hue.
      h.div(
        [
          h.Class('ff-cp-plane'),
          h.Style({
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${model.h}, 100%, 50%))`,
          }),
        ],
        [],
      ),
      h.div(
        [
          h.Class('ff-cp-thumb'),
          h.Style({
            left: `${model.s * 100}%`,
            top: `${(1 - model.v) * 100}%`,
            backgroundColor: `rgb(${parsed.r}, ${parsed.g}, ${parsed.b})`,
          }),
        ],
        [],
      ),
      // The stand-in cursor while hovering, placed by the runtime.
      h.div([h.Class('ff-cp-ghost'), h.AriaHidden(true)], []),
    ],
  );

  const hueRail = controlViews(`${model.cacheKey}-hue`, hueRailView, [
    model.hue,
    model.h,
    props.radius,
    h,
  ]);
  const alphaRail = h.submodel({
    slotId: 'alpha',
    model: model.alpha,
    view: Slider.view,
    toParentMessage: (message) => Message.Alpha({ message }),
    viewInputs: {
      value: Math.round(model.a * 100),
      label: 'Alpha',
      showValue: false,
      hideFill: true,
      thumbColor: solidColor,
      thumbBorderColor: 'rgba(255,255,255,0.9)',
      trackStyle: {
        backgroundImage: `linear-gradient(to right, rgba(${solid.r}, ${solid.g}, ${solid.b}, 0) 0%, ${solidColor} 98%), ${checker}`,
        backgroundSize: '100% 100%, 8px 8px',
        borderWidth: '0',
      },
      ...(props.radius ? { radius: props.radius } : {}),
    },
  });

  const formatMenu = controlViews(`${model.cacheKey}-format`, formatControlView, [
    model.formatMenu,
    model.formatMenuInitialized,
    props.formatOpen ?? model.formatMenuInternalOpen,
    model.format,
    size,
    props.radius,
    props.icons,
    props.portalMenu,
    props.formatBackdrop,
    props.formatOpen,
    h,
  ]);

  const eyedropper =
    model.eyedropper && !props.hideEyedropper
      ? h.button(
          [
            h.Type('button'),
            h.Class('ff-cp-control ff-cp-eyedropper'),
            h.AriaLabel('Pick color from screen'),
            h.OnClick(Message.EyedropperRequested()),
          ],
          [h.span([h.Class('ff-cp-glyph'), h.AriaHidden(true)], [icon('pipette', props.icons, h)])],
        )
      : null;

  const field = (
    channel: Channel,
    label: string,
    tipLabel: string,
    value: string,
    options: { readonly prefix?: string; readonly inputMode?: string } = {},
  ) => {
    const spec = channel === 'hex' ? undefined : channelSpecs[channel];
    const input = h.input([
      h.Class('ff-cp-input'),
      h.AriaLabel(label),
      h.Attribute('inputmode', options.inputMode ?? (spec ? 'numeric' : 'text')),
      h.Attribute('autocomplete', 'off'),
      h.Attribute('spellcheck', 'false'),
      // Runtime owns the uncommitted DOM draft. A controlled Value would
      // overwrite typing when an unrelated Tooltip Message redraws this field.
      h.Attribute('value', value),
      h.DataAttribute('value', value),
      h.DataAttribute('channel', channel),
      ...(spec
        ? [
            h.Role('spinbutton'),
            h.AriaValuemin(spec.min),
            h.AriaValuemax(spec.max),
            h.AriaValuenow(parseFloat(value.replace('%', ''))),
            h.AriaValuetext(value),
            h.DataAttribute('min', String(spec.min)),
            h.DataAttribute('max', String(spec.max)),
            h.DataAttribute('step', String(spec.step)),
            h.DataAttribute('shift-step', String(spec.shiftStep)),
            ...(spec.decimals === undefined
              ? []
              : [h.DataAttribute('decimals', String(spec.decimals))]),
            ...(spec.percent ? [h.DataAttribute('percent', '')] : []),
            ...(spec.wrap ? [h.DataAttribute('wrap', '')] : []),
          ]
        : []),
    ]);
    const prefix = options.prefix ? h.span([h.Class('ff-cp-prefix')], [options.prefix]) : null;
    return tip(channel, tipLabel, (attributes) =>
      h.div(
        [...attributes, h.Class('ff-cp-cell')],
        [
          h.div(
            [h.Class('ff-cp-field'), ...(spec ? [h.DataAttribute('scrub', '')] : [])],
            spec
              ? [h.span([h.Class('ff-cp-scrub'), h.Role('presentation')], [prefix, input])]
              : [prefix, input],
          ),
        ],
      ),
    );
  };
  const alphaField = field('alphaPercent', 'Alpha', 'Alpha', `${Math.round(parsed.a * 100)}%`);
  const inputRow = (fields: readonly Html[]) =>
    h.div(
      [h.Class('ff-cp-inputs'), h.DataAttribute('columns', model.format === 'hex' ? '2' : '4')],
      model.format === 'hex'
        ? fields
        : [
            Tooltip.Group.view(
              model.channelTooltips,
              {
                toMessage: (message) => Message.ChannelTip({ message }),
                children: fields,
              },
              h,
            ),
          ],
    );
  const inputs = (() => {
    switch (model.format) {
      case 'hex':
        return inputRow([
          field('hex', 'Hex value', 'Hex', parsed.hex.replace(/^#/, '').toUpperCase(), {
            prefix: '#',
          }),
          alphaField,
        ]);
      case 'rgb':
        return inputRow([
          field('r', 'Red', 'Red', String(parsed.r)),
          field('g', 'Green', 'Green', String(parsed.g)),
          field('b', 'Blue', 'Blue', String(parsed.b)),
          alphaField,
        ]);
      case 'hsl': {
        const hsl = rgbToHsl(parsed.r, parsed.g, parsed.b);
        return inputRow([
          field('hSL', 'Hue', 'Hue', String(Math.round(hsl.h))),
          field('sSL', 'Saturation', 'Saturation', String(Math.round(hsl.s * 100))),
          field('lSL', 'Lightness', 'Lightness', String(Math.round(hsl.l * 100))),
          alphaField,
        ]);
      }
      case 'oklch': {
        const oklch = rgbToOklch(parsed.r, parsed.g, parsed.b);
        return inputRow([
          field('L', 'Lightness', 'Lightness', (oklch.L * 100).toFixed(0), {
            inputMode: 'decimal',
          }),
          field('C', 'Chroma', 'Chroma', oklch.C.toFixed(2), { inputMode: 'decimal' }),
          field('H', 'Hue', 'Hue', (model.oklchHue ?? oklch.H).toFixed(0)),
          alphaField,
        ]);
      }
    }
  })();

  return h.div(
    [
      h.Class(
        `ff-color-picker flex flex-col gap-2 p-3 ${props.surface ?? 'bg-surface-3 shadow-surface-1'} ${shapeClass(props.radius, 'rounded-xl', 'rounded-3xl')} ${props.className ?? ''}`,
      ),
      h.DataAttribute('size', size),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.Style({ width: '280px' }),
      h.OnMount(Mounted()),
      h.DataAttribute(
        'cp-format-open',
        props.formatOpen === undefined ? 'auto' : String(props.formatOpen),
      ),
    ],
    [
      square,
      h.div([h.Class('ff-cp-rails')], [hueRail, alphaRail]),
      h.div([h.Class('ff-cp-inputs'), h.DataAttribute('columns', '2')], [formatMenu, eyedropper]),
      inputs,
      props.swatches && props.swatches.length > 0
        ? swatchViews(model.cacheKey, swatchStrip, [
            model.swatchTooltips,
            model.id,
            props.swatches,
            props.swatches.findIndex(
              (item) =>
                normalize(typeof item === 'string' ? item : item.color) ===
                parsed.hex.toLowerCase(),
            ),
            props.radius,
            h,
          ])
        : null,
    ],
  );
});

const normalize = (color: string) => {
  const parsed = parseColor(color) ?? resolveCssColor(color);
  return parsed
    ? rgbToHexStr(parsed.r, parsed.g, parsed.b, parsed.a).toLowerCase()
    : color.toLowerCase();
};
function swatchStrip(
  tooltips: Tooltip.Group.Model,
  id: string,
  swatches: readonly SwatchItem[],
  selected: number,
  radius: Props['radius'],
  h: HtmlBuilder<Message>,
): Html {
  const items = swatches.map((item) =>
    typeof item === 'string' ? { color: item, label: undefined } : item,
  );
  const row = h.div(
    [h.Class('ff-cp-swatches')],
    items.map(({ color, label }, index) => {
      const cell = (attributes: readonly ChildAttribute[]) =>
        h.button(
          [
            ...attributes,
            h.Key(`${color}-${index}`),
            h.Type('button'),
            h.Class('ff-cp-swatch'),
            h.AriaLabel(label ?? `Select color ${color}`),
            h.AriaPressed(String(index === selected)),
            h.OnClick(Message.SwatchPicked({ color })),
          ],
          [
            h.span([h.Class('ff-cp-band'), h.AriaHidden(true)], []),
            h.span(
              [
                h.Class('ff-cp-chip'),
                h.Style({ backgroundImage: checker, backgroundSize: '8px 8px' }),
              ],
              [h.span([h.Class('ff-cp-chip-color'), h.Style({ backgroundColor: color })], [])],
            ),
          ],
        );
      if (!label) return cell([]);
      const key = `swatch-${index}`;
      return Tooltip.Group.tip(
        tooltips,
        key,
        {
          content: label,
          sideOffset: 2,
          ...(radius ? { radius } : {}),
          renderTrigger: cell,
        },
        (message) => Message.SwatchTip({ message }),
        h,
      );
    }),
  );
  return items.some((item) => item.label)
    ? Tooltip.Group.view(
        tooltips,
        {
          toMessage: (message) => Message.SwatchTip({ message }),
          children: [row],
        },
        h,
      )
    : row;
}

/** Drag and Escape subscriptions for the two rails, keyed under `prefix` so
 * several pickers on one page keep their own identities. */
export function subscriptions<ParentModel, ParentMessage>(
  prefix: string,
  read: (model: ParentModel) => Model | undefined,
  toParentMessage: (message: Message) => ParentMessage,
) {
  const rail = (key: 'hue' | 'alpha') =>
    Subscription.lift(Slider.subscriptions)<ParentModel, ParentMessage>({
      read: (model) => Option.fromNullishOr(read(model)?.[key]),
      toParentMessage: (message) =>
        toParentMessage(key === 'hue' ? Message.Hue({ message }) : Message.Alpha({ message })),
    });
  return Object.fromEntries(
    (['hue', 'alpha'] as const).flatMap((key) =>
      Object.entries(rail(key)).map(([name, entry]) => [`${prefix}-${key}-${name}`, entry]),
    ),
  );
}

function hueRailView(
  model: Model['hue'],
  hue: number,
  radius: Props['radius'],
  h: HtmlBuilder<Message>,
): Html {
  return h.submodel({
    slotId: 'hue',
    model,
    view: Slider.view,
    toParentMessage: (message) => Message.Hue({ message }),
    viewInputs: {
      value: Math.round(hue),
      label: 'Hue',
      showValue: false,
      hideFill: true,
      thumbColor: `hsl(${hue}, 100%, 50%)`,
      thumbBorderColor: 'rgba(255,255,255,0.9)',
      trackStyle: { background: hueTrack, borderColor: 'transparent' },
      ...(radius ? { radius } : {}),
    },
  });
}

function formatControlView(
  stored: Model['formatMenu'],
  initialized: boolean,
  open: boolean,
  selectedFormat: Model['format'],
  size: NonNullable<Props['size']>,
  radius: Props['radius'],
  icons: Props['icons'],
  portalMenu: Props['portalMenu'],
  formatBackdrop: Props['formatBackdrop'],
  controlledOpen: Props['formatOpen'],
  h: HtmlBuilder<Message>,
): Html {
  // Project the initial prop for SSR/first paint. Later prop changes travel
  // through the observer and reducer before changing visibility, so a close
  // starts the primitive's retained exit instead of removing its popup early.
  const state =
    initialized || stored.isOpen === open
      ? stored
      : {
          ...stored,
          isOpen: open,
          animation: {
            ...stored.animation,
            isShowing: open,
          },
        };
  const formatOpen = state.isOpen;
  const formatTrigger = (open: boolean) => ({
    attributes: [
      h.Class('ff-cp-control ff-cp-format'),
      h.DataAttribute('cp-format-open', String(open)),
    ],
    children: [
      h.span([], [formatLabels[selectedFormat]]),
      h.span([h.Class('ff-cp-chevron'), h.AriaHidden(true)], [icon('chevron-down', icons, h)]),
    ],
  });
  const formatMenu = h.submodel({
    slotId: 'format',
    model: state,
    view: Dropdown.view,
    toParentMessage: (message) => Message.FormatMenu({ message, open: controlledOpen ?? null }),
    viewInputs: {
      label: formatLabels[selectedFormat],
      items: formats.map((format) => ({ value: format, label: formatLabels[format] })),
      selection: { mode: 'single' as const, value: selectedFormat },
      checkmarks: false,
      size,
      radius,
      surfaceLevel: 5,
      portal: portalMenu ?? true,
      backdrop: formatBackdrop,
      popupAttributes: childAttributes([h.DataAttribute('cp-format', '')]),
      trigger: formatTrigger(formatOpen),
    },
  });

  return formatMenu;
}
