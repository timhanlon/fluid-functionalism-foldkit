import type { Table as Engine } from '@tanstack/table-core';
import { childAttributes, type Html, type HtmlBuilder } from 'foldkit/html';
import * as Button from '../button';
import { colors, type Color } from '../badge';
import { FilterMounted } from './filter-runtime';
import * as KeyCap from '../key-cap';
import * as Tooltip from '../tooltip';
import * as Input from '../input';
import * as Dropdown from '../dropdown';
import * as Select from '../select';
import * as DatePicker from '../date-picker';
import * as Calendar from '../calendar';
import { icon } from '../icons';
import { metaOf, utilityColumns } from './engine';
import { dateFilterPresets, emptyFilter, filterOf, optionOf, textOps } from './filters';
import {
  Message,
  action,
  menuModel,
  dateModel,
  selectModel,
  tooltipModel,
  type Model,
} from './state';
import { SelectionPortal } from './context';
import { Option } from 'effect';
import type { Props, FilterValue, TextOp } from './types';

export function menu(
  model: Model,
  key: string,
  props: Dropdown.Props,
  h: HtmlBuilder<Message>,
): Html {
  return h.submodel({
    slotId: `menu-${key}`,
    model: menuModel(model, key),
    view: Dropdown.view,
    toParentMessage: (message) => Message.Menu({ generation: model.generation, key, message }),
    viewInputs: props,
  });
}
export function iconTrigger<T>(
  label: string,
  glyph: Html,
  props: Props<T>,
  h: HtmlBuilder<Message>,
): NonNullable<Dropdown.Props['trigger']> {
  const visual = Button.decoration(
    {
      label,
      children: [glyph],
      variant: 'ghost',
      size: props.size === 'compact' ? 'icon-compact' : 'icon',
      radius: props.radius,
    },
    h,
  );
  return {
    attributes: visual.attributes.flatMap((attribute) =>
      'attribute' in attribute ? [attribute] : childAttributes([attribute]),
    ),
    children: visual.children,
  };
}
export function select(
  model: Model,
  key: string,
  props: Select.Props,
  h: HtmlBuilder<Message>,
): Html {
  return h.submodel({
    slotId: `select-${key}`,
    model: selectModel(model, key),
    view: Select.view,
    toParentMessage: (message) => Message.Select({ generation: model.generation, key, message }),
    viewInputs: props,
  });
}
export function search<T>(model: Model, props: Props<T>, h: HtmlBuilder<Message>): Html {
  const query =
    typeof model.table.globalFilter === 'string'
      ? model.table.globalFilter
      : (model.table.globalFilter?.query ?? '');
  const label = props.searchPlaceholder?.replace(/…$/, '') ?? 'Search table';
  if (props.searchCollapsible !== false && !model.searchOpen && !query)
    return Button.view<Message>(
      {
        label,
        children: [icon('search', props.icons, h)],
        onClick: Message.SearchToggled(),
        variant: 'ghost',
        size: props.size === 'compact' ? 'icon-compact' : 'icon',
        radius: props.radius,
      },
      h,
    );
  return h.div(
    [h.Class('ff-data-table-search')],
    [
      icon('search', props.icons, h, { className: 'ff-data-table-search-icon' }),
      Input.view(
        {
          id: `${model.id}-g${model.generation}-search`,
          value: query,
          onInput: (query) =>
            Message.Searched({
              query,
              ...(props.searchColumn ? { columnId: props.searchColumn } : {}),
            }),
          ariaLabel: label,
          placeholder: props.searchPlaceholder ?? 'Search…',
          size: props.size,
          radius: props.radius,
          type: 'search',
          attributes: [h.OnBlur(Message.SearchBlurred())],
        },
        h,
      ),
    ],
  );
}
export function title<T>(props: Props<T>, table: Engine<T>, h: HtmlBuilder<Message>): Html {
  const columns = new Set(table.getVisibleLeafColumns().map((column) => column.id));
  const gutter = columns.has('drag')
    ? columns.has('select')
      ? 'both'
      : 'drag'
    : columns.has('select')
      ? 'select'
      : 'none';
  return h[props.titleAs ?? 'h2'](
    [h.Class('ff-data-table-title'), h.DataAttribute('leading', gutter)],
    [props.title ?? props.label],
  );
}
export function viewOptions<T>(
  model: Model,
  props: Props<T>,
  table: Engine<T>,
  h: HtmlBuilder<Message>,
): Html {
  const items = table
    .getAllLeafColumns()
    .filter((c) => !utilityColumns.has(c.id))
    .flatMap((column) => {
      const label = metaOf(column).label ?? String(column.columnDef.header ?? column.id);
      return [
        {
          value: action(
            Message.ColumnShown({ columnId: column.id, visible: !column.getIsVisible() }),
          ),
          label: `${column.getIsVisible() ? 'Hide' : 'Show'} ${label}`,
        },
        {
          value: action(
            Message.ColumnLinesChanged({
              columnId: column.id,
              lines: model.columnLines[column.id] === 'wrap' ? 1 : 'wrap',
            }),
          ),
          label: `Wrap ${label}`,
        },
      ];
    });
  return menu(
    model,
    'columns',
    {
      label: 'Columns',
      trigger: iconTrigger('Columns', icon('sliders-horizontal', props.icons, h), props, h),
      icon: icon('sliders-horizontal', props.icons, h),
      items,
      size: props.size,
      radius: props.radius,
    },
    h,
  );
}
export function filters<T>(
  model: Model,
  props: Props<T>,
  table: Engine<T>,
  h: HtmlBuilder<Message>,
): Html {
  if (model.table.columnFilters.length)
    return Button.view<Message>(
      {
        label: 'Filters',
        children: [icon('filter', props.icons, h)],
        onClick: Message.FiltersToggled(),
        active: !model.filtersHidden,
        variant: 'ghost',
        size: props.size === 'compact' ? 'icon-compact' : 'icon',
        radius: props.radius,
      },
      h,
    );
  return menu(
    model,
    'filters',
    {
      label: 'Filter',
      trigger: iconTrigger('Filter', icon('filter', props.icons, h), props, h),
      icon: icon('filter', props.icons, h),
      size: props.size,
      radius: props.radius,
      items: table.getAllLeafColumns().flatMap((column) => {
        const kind = filterOf(table, column);
        return kind
          ? [
              {
                value: action(
                  Message.FilterChanged({
                    columnId: column.id,
                    value: column.getFilterValue() ?? emptyFilter(kind),
                  }),
                ),
                label: metaOf(column).label ?? String(column.columnDef.header ?? column.id),
              },
            ]
          : [];
      }),
    },
    h,
  );
}
export function filterChips<T>(
  model: Model,
  props: Props<T>,
  table: Engine<T>,
  h: HtmlBuilder<Message>,
): Html {
  return h.div(
    [
      h.Class('ff-data-table-filters'),
      h.Hidden(model.filtersHidden || !model.table.columnFilters.length),
    ],
    model.table.columnFilters
      .map(({ id, value }) => {
        const column = table.getColumn(id);
        if (!column) return null;
        const filter = value as FilterValue;
        const label = metaOf(column).label ?? String(column.columnDef.header ?? id);
        const changed = (value: FilterValue) => Message.FilterChanged({ columnId: id, value });
        const operator = (
          word: string,
          current: string,
          ops: readonly string[],
          change: (op: string) => Message,
        ) =>
          menu(
            model,
            `filter-op-${id}`,
            {
              label: `${label}: ${word}`,
              trigger: {
                attributes: childAttributes([
                  h.Class('ff-data-table-filter-segment'),
                  h.AriaLabel(`${label}: ${word}`),
                ]),
                children: [h.span([], [word])],
              },
              items: ops.map((op) => ({
                label: op.charAt(0).toUpperCase() + op.slice(1),
                value: action(change(op)),
              })),
              selection: { mode: 'single', value: action(change(current)) },
              popupAttributes: childAttributes([h.DataAttribute('table-filter-menu', 'operator')]),
              size: props.size,
              radius: props.radius,
            },
            h,
          );
        const field = (
          name: string,
          value: string,
          onInput: (value: string) => Message,
          type = 'text',
          ariaLabel = `${label} ${name === 'Min' ? 'from' : name === 'Max' ? 'to' : name}`,
        ) =>
          Input.view(
            {
              id: `${model.id}-filter-${encodeURIComponent(id)}-${name}`,
              value,
              onInput,
              type,
              ariaLabel,
              placeholder: name === 'value' ? 'text' : name.toLowerCase(),
              size: props.size,
              radius: props.radius,
            },
            h,
          );
        let controls: Html[] = [];
        if (typeof filter === 'string' || filter.kind === 'text') {
          const current =
            typeof filter === 'string' ? { kind: 'text' as const, query: filter } : filter;
          controls = [
            operator(current.op ?? 'contains', current.op ?? 'contains', textOps, (op) =>
              changed({ ...current, op: op as TextOp }),
            ),
            h.label(
              [
                h.Class('ff-data-table-filter-segment'),
                h.Hidden(current.op === 'is empty' || current.op === 'is not empty'),
              ],
              [
                field(
                  'value',
                  current.query,
                  (query) => changed({ ...current, query }),
                  'text',
                  `${label} ${current.op ?? 'contains'}`,
                ),
              ],
            ),
          ];
        } else if (filter.kind === 'number') {
          controls = [
            h.span([h.Class('ff-data-table-filter-word')], ['from']),
            h.label(
              [h.Class('ff-data-table-filter-segment')],
              [
                field(
                  'Min',
                  filter.min === undefined ? '' : String(filter.min),
                  (value) => changed({ ...filter, min: value === '' ? undefined : Number(value) }),
                  'number',
                ),
                h.span([h.Class('ff-data-table-filter-range-connector')], ['to']),
                field(
                  'Max',
                  filter.max === undefined ? '' : String(filter.max),
                  (value) => changed({ ...filter, max: value === '' ? undefined : Number(value) }),
                  'number',
                ),
              ],
            ),
          ];
        } else if (filter.kind === 'date') {
          controls = [
            operator(
              filter.op ?? 'between',
              filter.op ?? 'between',
              ['between', 'before', 'after'],
              (word) => {
                const op = word as 'between' | 'before' | 'after';
                const day =
                  filter.op === 'before'
                    ? filter.to
                    : filter.op === 'after'
                      ? filter.from
                      : (filter.from ?? filter.to);
                return changed(
                  op === 'before' ? { kind: 'date', op, to: day } : { kind: 'date', op, from: day },
                );
              },
            ),
            h.submodel({
              slotId: `filter-date-${id}`,
              model: dateModel(model, `filter-${id}`),
              view: DatePicker.view,
              toParentMessage: (message) =>
                Message.FilterDate({
                  key: `filter-${id}`,
                  columnId: id,
                  generation: model.generation,
                  message,
                }),
              viewInputs: {
                label: `${label} ${filter.op ?? 'between'}`,
                mode: !filter.op || filter.op === 'between' ? 'range' : 'single',
                presets:
                  !filter.op || filter.op === 'between'
                    ? dateFilterPresets(model.today)
                    : undefined,
                controlled: true,
                value:
                  !filter.op || filter.op === 'between'
                    ? Calendar.range(
                        filter.from
                          ? Calendar.fromNative(new Date(`${filter.from}T12:00:00`))
                          : undefined,
                        filter.to
                          ? Calendar.fromNative(new Date(`${filter.to}T12:00:00`))
                          : undefined,
                      )
                    : (filter.op === 'before' ? filter.to : filter.from)
                      ? Calendar.single(
                          Calendar.fromNative(
                            new Date(
                              `${filter.op === 'before' ? filter.to : filter.from}T12:00:00`,
                            ),
                          ),
                        )
                      : Calendar.none(),
                size: props.size,
                radius: props.radius,
                icons: props.icons,
                variant: 'ghost',
                fitLabel: true,
                typeable: true,
                placeholder: 'any day',
              },
            }),
          ];
        } else {
          const kind = filterOf(table, column);
          const options = typeof kind === 'object' ? kind.options.map(optionOf) : [];
          const picked = options.filter((option) => filter.values.includes(option.value));
          const word =
            filter.op === 'is not'
              ? filter.values.length > 1
                ? 'is none of'
                : 'is not'
              : filter.values.length > 1
                ? 'is any of'
                : 'is';
          const valueLabel = `${label} ${word} ${picked.length ? picked.map((option) => option.label).join(', ') : 'any'}`;
          const dot = (color: Color) =>
            h.span(
              [
                h.Class('ff-data-table-filter-dot'),
                h.AriaHidden(true),
                h.Style({
                  background: color === 'gray' ? 'var(--muted-foreground)' : colors[color],
                }),
              ],
              [],
            );
          const items = options.map((option) => ({
            label: option.label,
            leading: option.color ? dot(option.color) : undefined,
            value: action(
              changed({
                ...filter,
                values: filter.values.includes(option.value)
                  ? filter.values.filter((v) => v !== option.value)
                  : [...filter.values, option.value],
              }),
            ),
          }));
          controls = [
            operator(word, filter.op ?? 'is', ['is', 'is not'], (op) =>
              changed({ ...filter, op: op as 'is' | 'is not' }),
            ),
            menu(
              model,
              `filter-options-${id}`,
              {
                label: valueLabel,
                trigger: {
                  attributes: childAttributes([
                    h.Class('ff-data-table-filter-segment ff-data-table-filter-values'),
                    h.AriaLabel(valueLabel),
                    h.DataAttribute('empty', String(!picked.length)),
                  ]),
                  children:
                    picked.length === 0
                      ? [h.span([], ['any'])]
                      : picked.length === 1
                        ? [
                            picked[0]!.color ? dot(picked[0]!.color) : null,
                            h.span(
                              [h.Class('ff-data-table-filter-value-text')],
                              [picked[0]!.label],
                            ),
                          ]
                        : [
                            h.span(
                              [h.Class('ff-data-table-filter-dots')],
                              picked
                                .slice(0, 4)
                                .flatMap((option) => (option.color ? [dot(option.color)] : [])),
                            ),
                            h.span([], [`${picked.length} items`]),
                          ],
                },
                selection: {
                  mode: 'multiple',
                  values: items
                    .filter((_, index) => filter.values.includes(options[index]!.value))
                    .map((item) => item.value),
                },
                popupAttributes: childAttributes([h.DataAttribute('table-filter-menu', 'options')]),
                size: props.size,
                radius: props.radius,
                items,
              },
              h,
            ),
          ];
        }
        return h.div(
          [h.Key(id), h.Class('ff-data-table-filter'), h.OnMount(FilterMounted())],
          [
            h.span(
              [h.Class('ff-data-table-filter-content')],
              [
                h.span([h.Class('ff-data-table-filter-label')], [label]),
                ...controls,
                h.submodel({
                  slotId: `filter-remove-${id}`,
                  model: tooltipModel(model, `filter-remove-${id}`),
                  view: Tooltip.view,
                  toParentMessage: (message) =>
                    Message.Tooltip({
                      generation: model.generation,
                      key: `filter-remove-${id}`,
                      message,
                    }),
                  viewInputs: {
                    content: 'Remove filter',
                    radius: props.radius,
                    renderTrigger: (attributes) =>
                      Button.view<Message>(
                        {
                          label: `Remove the ${label} filter`,
                          children: [icon('x', props.icons, h)],
                          onClick: Message.FilterRemoved({ columnId: id }),
                          variant: 'ghost',
                          size: 'icon-compact',
                          radius: props.radius,
                          className: 'ff-data-table-filter-remove ff-data-table-filter-segment',
                          attributes,
                        },
                        h,
                      ),
                  },
                }),
              ],
            ),
          ],
        );
      })
      .concat(
        model.table.columnFilters.length
          ? [
              menu(
                model,
                'add-filter',
                {
                  label: 'Add filter',
                  trigger: iconTrigger('Add filter', icon('plus', props.icons, h), props, h),
                  size: props.size,
                  radius: props.radius,
                  items: table.getAllLeafColumns().flatMap((column) => {
                    const kind = filterOf(table, column);
                    return kind
                      ? [
                          {
                            label:
                              metaOf(column).label ?? String(column.columnDef.header ?? column.id),
                            value: action(
                              Message.FilterChanged({
                                columnId: column.id,
                                value: column.getFilterValue() ?? emptyFilter(kind),
                              }),
                            ),
                          },
                        ]
                      : [];
                  }),
                },
                h,
              ),
            ]
          : [],
        props.renderFilterActions?.() ?? null,
      ),
  );
}
export function pagination<T>(
  model: Model,
  props: Props<T>,
  table: Engine<T>,
  h: HtmlBuilder<Message>,
): Html {
  const total = table.getFilteredRowModel().rows.length;
  const selected = table
    .getFilteredSelectedRowModel()
    .flatRows.filter((row) => !row.subRows.length).length;
  const pageCount = Math.max(1, table.getPageCount()),
    page = Math.min(model.table.pagination.pageIndex + 1, pageCount),
    pageSize = model.table.pagination.pageSize;
  const sizes = props.pageSizes ?? [10, 20, 50];
  const count = selected
    ? `${selected} of ${total} ${total === 1 ? 'row' : 'rows'} selected`
    : pageCount > 1
      ? `${Math.max(0, Math.min(pageSize, total - (page - 1) * pageSize))} / ${total} rows`
      : `${total} ${total === 1 ? 'row' : 'rows'}`;
  return h.div(
    [h.Class('ff-data-table-pagination')],
    [
      h.span([h.Attribute('aria-live', 'polite')], [count]),
      h.div(
        [],
        [
          sizes.length
            ? h.span(
                [h.Class('ff-data-table-page-size')],
                [
                  'Rows per page',
                  select(
                    model,
                    'page-size',
                    {
                      label: 'Rows per page',
                      value: String(pageSize),
                      items: [...new Set([...sizes, pageSize])]
                        .sort((a, b) => a - b)
                        .map((n) => ({ value: String(n), label: String(n) })),
                      variant: 'borderless',
                      size: props.size,
                      radius: props.radius,
                    },
                    h,
                  ),
                ],
              )
            : null,
          h.span(
            [h.Class('ff-data-table-page-navigation')],
            [
              h.span([], [`Page ${page} of ${pageCount}`]),
              Button.view<Message>(
                {
                  label: 'Previous page',
                  children: [icon('arrow-left', props.icons, h)],
                  disabled: !table.getCanPreviousPage(),
                  onClick: Message.PageChanged({ page: page - 2 }),
                  variant: 'ghost',
                  size: props.size === 'compact' ? 'icon-compact' : 'icon',
                  radius: props.radius,
                },
                h,
              ),
              Button.view<Message>(
                {
                  label: 'Next page',
                  children: [icon('arrow-right', props.icons, h)],
                  disabled: !table.getCanNextPage(),
                  onClick: Message.PageChanged({ page }),
                  variant: 'ghost',
                  size: props.size === 'compact' ? 'icon-compact' : 'icon',
                  radius: props.radius,
                },
                h,
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
export function selectionBar<T>(
  model: Model,
  props: Props<T>,
  table: Engine<T>,
  h: HtmlBuilder<Message>,
): Html | null {
  const selected = table.getSelectedRowModel().flatRows.filter((row) => !row.subRows.length).length;
  const digits = String(selected);
  return !selected
    ? null
    : h.div(
        [
          h.Class('ff-data-table-selection'),
          h.DataAttribute('size', props.size ?? 'default'),
          h.DataAttribute('radius', props.radius ?? 'rounded'),
          h.OnMount(SelectionPortal({ rootId: model.id })),
          h.Role('toolbar'),
          h.AriaLabel('Selection actions'),
          h.OnKeyDownPreventDefault((key, modifiers) =>
            key === 'Escape'
              ? Option.some(Message.SelectionCleared())
              : (modifiers.metaKey || modifiers.ctrlKey) && key.toLowerCase() === 'k'
                ? Option.some(Message.ActionsOpened())
                : Option.none(),
          ),
        ],
        [
          h.span(
            [h.Attribute('aria-live', 'polite')],
            [
              h.span([h.Class('sr-only')], [`${selected} selected`]),
              h.span(
                [h.Attribute('aria-hidden', 'true')],
                [
                  h.span(
                    [h.Class('ff-data-table-selection-count'), h.DataAttribute('count', digits)],
                    [
                      h.span(
                        [h.Class('ff-data-table-selection-digits')],
                        [...digits].map((digit, index) =>
                          h.span([h.Key(String(digits.length - index))], [digit]),
                        ),
                      ),
                    ],
                  ),
                  ' selected',
                ],
              ),
            ],
          ),
          props.selectionActions?.length
            ? Button.view<Message>(
                {
                  children: [
                    'Actions',
                    KeyCap.keys(
                      { keys: ['⌘', 'K'], className: 'ff-data-table-action-shortcut' },
                      h,
                    ),
                  ],
                  className: 'ff-data-table-selection-actions',
                  attributes: [
                    h.Attribute('aria-keyshortcuts', 'Meta+k Control+k'),
                    h.DataAttribute('trailing', ''),
                  ],
                  onClick: Message.ActionsOpened(),
                  variant: 'ghost',
                  size: props.size,
                  radius: props.radius,
                },
                h,
              )
            : null,
          h.submodel({
            slotId: 'selection-clear-tooltip',
            model: tooltipModel(model, 'selection-clear'),
            view: Tooltip.view,
            toParentMessage: (message) =>
              Message.Tooltip({ generation: model.generation, key: 'selection-clear', message }),
            viewInputs: {
              content: 'Clear selection',
              dismissOnHoverEscape: true,
              portal: false,
              shortcut: ['Esc'],
              radius: props.radius,
              renderTrigger: (attributes) =>
                Button.view<Message>(
                  {
                    label: 'Clear selection',
                    children: [icon('x', props.icons, h)],
                    onClick: Message.SelectionCleared(),
                    variant: 'ghost',
                    size: props.size === 'compact' ? 'icon-compact' : 'icon',
                    radius: props.radius,
                    attributes: [...attributes, h.Attribute('aria-keyshortcuts', 'Escape')],
                  },
                  h,
                ),
            },
          }),
        ],
      );
}
