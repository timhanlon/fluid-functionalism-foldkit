import { Input } from '@foldkit/ui';
import { Mount, Submodel } from 'foldkit';
import type { Html, ChildAttribute } from 'foldkit/html';
import * as Dropdown from './index';
import { Model, Message, matches, createCandidate } from './search-state';
import { icon } from '../icons';
import { SearchMounted } from './search-runtime';
import { primitiveMessage } from './state';
export { Model, Message, OutMessage, init, update, matches, createCandidate } from './search-state';

export interface Props extends Omit<
  Dropdown.Props,
  'renderItemsHeader' | 'renderItemsFooter' | 'scrollFade'
> {
  /** Clear the query on opening and field removal. Defaults to true. Pass the same value to update. */
  readonly clearOnClose?: boolean;
  /** Native input attributes and consumer event handlers, bound to their owner. */
  readonly inputAttributes?: readonly ChildAttribute[];
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  readonly searchIcon?: Html;
  readonly creatable?: boolean;
  readonly createLabel?: (query: string) => string;
  readonly createIcon?: Html;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const header = h.div(
    [h.Class('ff-dropdown-search')],
    [
      props.searchIcon ?? icon('search', props.icons, h),
      Input.view(
        {
          id: `${model.menu.id}-search`,
          value: model.query,
          placeholder: props.placeholder ?? 'Search…',
          onInput: (value) => Message.QueryChanged({ value, lifetime: model.menu.lifetime }),
          toView: ({ input }) =>
            h.input([
              ...input,
              h.Role('searchbox'),
              h.AriaLabel(props.placeholder ?? 'Search…'),
              h.Class('ff-dropdown-search-input'),
              h.Autocomplete('off'),
              h.Autocorrect('off'),
              h.Spellcheck(false),
              h.DataAttribute('search-clear-on-close', String(props.clearOnClose !== false)),
              h.OnUnmount(
                Message.SearchUnmounted({
                  clearQuery: props.clearOnClose !== false,
                  lifetime: model.menu.lifetime,
                }),
              ),
              ...(props.inputAttributes ?? []),
              h.OnMount(
                Mount.mapMessage(SearchMounted(), (message) => ({
                  ...message,
                  lifetime: model.menu.lifetime,
                })),
              ),
            ]),
        },
        h,
      ),
    ],
  );
  const candidate = props.creatable ? createCandidate(props.items, model.query) : undefined;
  let createValue = '\u0000ff-create';
  while (props.items.some((item) => item.value === createValue)) createValue += ':';
  const items = [
    ...matches(props.items, model.query),
    ...(candidate
      ? [
          {
            value: createValue,
            action: true,
            label: props.createLabel?.(candidate) ?? `Create “${candidate}”`,
            icon:
              props.createIcon !== undefined
                ? props.createIcon
                : h.svg(
                    [
                      h.ViewBox('0 0 24 24'),
                      h.Fill('none'),
                      h.Stroke('currentColor'),
                      h.StrokeWidth('1.5'),
                      h.StrokeLinecap('round'),
                      h.StrokeLinejoin('round'),
                      h.AriaHidden(true),
                    ],
                    [h.path([h.D('M12 5v14M5 12h14')], [])],
                  ),
          },
        ]
      : []),
  ];
  return h.submodel({
    slotId: 'menu',
    model: model.menu,
    view: Dropdown.view,
    toParentMessage: (message) => {
      const event = primitiveMessage(message);
      return event?._tag === 'SelectedItem' && candidate && event.item === createValue
        ? Message.CreatedRequested({ value: candidate, lifetime: model.menu.lifetime })
        : Message.Behavior({ message, lifetime: model.menu.lifetime });
    },
    viewInputs: {
      ...props,
      items,
      renderItemsHeader: () => header,
      scrollFade: false,
      renderItemsFooter: () =>
        items.length
          ? null
          : h.div(
              [h.Class('ff-dropdown-empty'), h.Role('status'), h.Attribute('aria-live', 'polite')],
              [props.emptyLabel ?? 'No results'],
            ),
    },
  });
});
