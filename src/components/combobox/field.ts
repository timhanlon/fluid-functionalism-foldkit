import { Combobox as Primitive } from '@foldkit/ui';
import { Option } from 'effect';
import { Mount } from 'foldkit';
import { childAttributes, type Html, type HtmlBuilder } from 'foldkit/html';
import { icon } from '../icons';
import { Mounted, rowContent } from '../popup';
import type { Filter } from './filter';
import { itemLabel, itemValue, itemDisabled, type ItemData } from './item';
export type { Item, ItemData } from './item';
export interface CommonProps<Data extends ItemData = ItemData> {
  readonly items: readonly Data[];
  /** Filter the item dataset passed to the primitive view. */
  readonly filter?: Filter<Data>;
  readonly label: string;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  readonly icon?: Html;
  readonly clearable?: boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly error?: string;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly variant?: 'bordered' | 'borderless';
  readonly name?: string;
  readonly creatable?: boolean;
  readonly createLabel?: (query: string) => string;
  readonly createIcon?: Html;
}

export interface FieldState {
  readonly combo: Primitive.Model;
  readonly display: string;
  readonly resting: string;
  readonly hasSelection: boolean;
  readonly multiple?: boolean;
}
export function fieldInputs<Message, Data extends ItemData>(
  state: FieldState,
  props: CommonProps<Data>,
  rows: readonly ItemData[],
  h: HtmlBuilder<Message>,
  actions: {
    readonly behavior: (message: Primitive.Message) => Message;
    readonly clear: Message;
    readonly focus: Message;
  },
): Primitive.BaseViewInputsCommon<string> {
  const glyph = (path: string) =>
    h.svg(
      [
        h.ViewBox('0 0 24 24'),
        h.Fill('none'),
        h.Stroke('currentColor'),
        h.StrokeWidth('2'),
        h.StrokeLinecap('round'),
        h.StrokeLinejoin('round'),
        h.AriaHidden(true),
      ],
      [h.path([h.D(path)], [])],
    );
  return {
    items: rows.map(itemValue),
    restingInputValue: state.resting,
    itemToValue: (value) => value,
    itemToDisplayText: (value) =>
      itemLabel(rows.find((item) => itemValue(item) === value) ?? value),
    isItemDisabled: (value) =>
      itemDisabled(rows.find((item) => itemValue(item) === value) ?? value),
    isDisabled: props.disabled,
    isReadOnly: props.readOnly,
    isInvalid: !!props.error,
    ariaLabel: props.label,
    openOnFocus: false,
    formName: props.name,
    anchor: { placement: 'bottom-start', gap: 6, padding: 8, portal: true },
    className: 'ff-combobox',
    attributes: childAttributes([
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('variant', props.variant ?? 'bordered'),
      h.DataAttribute('multiple', String(!!state.multiple)),
    ]),
    inputWrapperClassName: 'ff-combobox-input-wrapper',
    inputWrapperAttributes: childAttributes([
      h.OnPointerDown((_kind, button, _sx, _sy, _time, _cx, _cy, _id, target) =>
        button === 0 &&
        !props.disabled &&
        target instanceof Element &&
        !target.closest('input,button,[data-combobox-chip]')
          ? Option.some(actions.focus)
          : Option.none(),
      ),
    ]),
    inputClassName: 'ff-combobox-input',
    inputPlaceholder: props.placeholder ?? 'Search…',
    inputAttributes: childAttributes([
      h.Disabled(!!props.disabled),
      ...(!state.combo.isOpen && !props.disabled && !props.readOnly
        ? [
            h.OnClick(
              actions.behavior(Primitive.Message.Opened({ maybeActiveItemIndex: Option.none() })),
            ),
          ]
        : []),
      ...(props.error ? [h.AriaDescribedBy(`${state.combo.id}-error`)] : []),
    ]),
    renderInputPrefix: () =>
      h.span(
        [h.Class('contents')],
        [
          props.icon
            ? h.span([h.Class('ff-combobox-icon'), h.AriaHidden(true)], [props.icon])
            : null,
        ],
      ),
    renderInputSuffix: () =>
      props.clearable
        ? h.span(
            [h.Class('ff-combobox-clear-slot')],
            [
              h.button(
                [
                  h.Type('button'),
                  h.Class('ff-combobox-clear'),
                  h.AriaLabel('Clear'),
                  h.Hidden(!state.display && !state.hasSelection),
                  h.Disabled(!!props.disabled || !!props.readOnly),
                  h.OnClick(actions.clear),
                  h.OnMount(
                    Mount.mapMessage(Primitive.AttachComboboxPreventBlur(), (message) =>
                      actions.behavior(message),
                    ),
                  ),
                ],
                [icon('x', props.icons, h)],
              ),
            ],
          )
        : null,
    buttonContent: glyph('m6 9 6 6 6-6'),
    buttonClassName: 'ff-combobox-toggle',
    buttonAttributes: childAttributes([h.AriaLabel('Open'), h.Disabled(!!props.disabled)]),
    backdropClassName: 'ff-popup-backdrop ff-combobox-backdrop',
    itemsClassName: 'ff-popup ff-combobox-popup',
    itemsAttributes: childAttributes([
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius === 'sharp' ? 'sharp' : 'rounded'),
      h.DataAttribute('selection', state.multiple ? 'multiple' : 'single'),
      h.DataAttribute('focus-owner', Primitive.inputId(state.combo.id)),
      h.DataAttribute('keyboard-navigation', String(state.combo.activationTrigger === 'Keyboard')),
    ]),
    itemsScrollClassName: 'ff-popup-viewport ff-scroll-fade',
    itemsScrollAttributes: childAttributes([h.OnMount(Mounted())]),
    itemToConfig: (value) => {
      const item = rows.find((item) => itemValue(item) === value) ?? value;
      return {
        className: 'ff-popup-row',
        content: rowContent(
          {
            label: itemLabel(item),
            icon: typeof item === 'string' ? undefined : item.icon,
            check: true,
          },
          h,
        ),
      };
    },
    renderItemsFooter: () =>
      rows.length
        ? null
        : h.div(
            [h.Class('ff-combobox-empty'), h.Role('status'), h.Attribute('aria-live', 'polite')],
            [props.emptyLabel ?? 'No results found.'],
          ),
  };
}
