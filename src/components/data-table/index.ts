// Ported from mickadesign/fluid-functionalism at f801409896c2bb3f34c67a82e1e70c3dd3f47c8e:
// registry/default/data-table.tsx. Interaction state belongs to Foldkit; table
// calculations use the same TanStack core as the source React adapter.
import { DragAndDrop } from '@foldkit/ui';
import { Submodel } from 'foldkit';
import { Option } from 'effect';
import { childAttributes, type Attribute, type Html, type HtmlBuilder } from 'foldkit/html';
import type { Column, Row, Table as Engine } from '@tanstack/table-core';
import * as Table from '../table';
import * as ContextMenu from '../context-menu';
import * as Button from '../button';
import * as Input from '../input';
import * as Textarea from '../textarea';
import * as Checkbox from '../checkbox';
import * as DatePicker from '../date-picker';
import * as Calendar from '../calendar';
import * as Combobox from '../combobox';
import { icon } from '../icons';
import { engine, metaOf, utilityColumns, drawnColumns, displayedRows } from './engine';
import { Message, type Model, action, dateModel, numberModel, tagsModel } from './state';
import type { ColumnDef, Props } from './types';
import * as Parts from './parts';
import { optionOf, filterOf, emptyFilter } from './filters';
import { Mounted } from './runtime';
import { restColumn, sizingConfig } from './sizing';
import { Surface } from './expansion';
import { carriedRows, ghosts } from './drag';
import { hoverMarkers, markerColumns } from './hover-markers';
import * as Frozen from './frozen';
import * as ScrollArea from '../scroll-area';
import * as Tree from './tree';
import * as Dropdown from '../dropdown';
import * as Dialog from '../dialog';
import * as Actions from '../command-menu/dialog';
import './styles.css';
export { Model, Message, OutMessage, init, update, subscriptions, moveRows } from './state';
export { engine } from './engine';
export * from './types';
export {
  search,
  title,
  filters,
  filterChips,
  viewOptions,
  pagination,
  selectionBar,
} from './parts';

export const selectColumn = <T>(): ColumnDef<T> => ({
  id: 'select',
  header: '',
  size: 28,
  minSize: 28,
  maxSize: 28,
  enableSorting: false,
  enableResizing: false,
  enableHiding: false,
});
export const rowHandleColumn = <T>(): ColumnDef<T> => ({
  id: 'drag',
  header: '',
  size: 20,
  minSize: 20,
  maxSize: 20,
  enableSorting: false,
  enableResizing: false,
  enableHiding: false,
});
export const rowActionsColumn = <T>(): ColumnDef<T> => ({
  id: 'actions',
  header: '',
  size: 36,
  minSize: 36,
  maxSize: 36,
  enableSorting: false,
  enableResizing: false,
  enableHiding: false,
});

function cellAttributes<T>(
  model: Model,
  column: Column<T>,
  h: HtmlBuilder<Message>,
  size?: 'default' | 'compact',
  rest?: string,
): Attribute<Message>[] {
  const pinned = column.getIsPinned(),
    lines = model.columnLines[column.id] ?? metaOf(column).lines ?? 1;
  return [
    h.Key(column.id),
    h.DataAttribute(
      'dragged',
      String(
        DragAndDrop.isDragging(model.columnDrag) &&
          Option.getOrUndefined(DragAndDrop.maybeDraggedItemId(model.columnDrag)) ===
            `${model.id}-column-${encodeURIComponent(column.id)}`,
      ),
    ),
    h.DataAttribute('column', column.id),
    h.DataAttribute('lines', String(lines)),
    ...(pinned ? [h.DataAttribute('pinned', pinned)] : []),
    ...(pinned &&
    (pinned === 'left' ? column.getIsLastColumn('left') : column.getIsFirstColumn('right'))
      ? [h.DataAttribute('pin-edge', pinned)]
      : []),
    h.Style({
      ...(column.id !== rest
        ? {
            width: `${column.id === 'actions' && size === 'compact' ? column.getSize() - 4 : column.getSize()}px`,
          }
        : {}),
      minWidth: `${column.id === 'actions' && size === 'compact' ? column.getSize() - 4 : column.getSize()}px`,
      ...(pinned === 'left'
        ? { left: `${column.getStart('left')}px` }
        : pinned === 'right'
          ? { right: `${column.getAfter('right')}px` }
          : {}),
    }),
  ];
}
function header<T>(model: Model, props: Props<T>, table: Engine<T>, h: HtmlBuilder<Message>): Html {
  const dataColumns = drawnColumns(table).filter((column) => !utilityColumns.has(column.id));
  const rest = restColumn(table, !!props.resizeColumns);
  return Table.header<Message>(
    {
      children: [
        Table.row<Message>(
          {
            keepRule: props.fill,
            children: drawnColumns(table).map((column, index) => {
              const label = metaOf(column).label ?? String(column.columnDef.header ?? column.id),
                sort = column.getIsSorted();
              const attrs = [
                ...cellAttributes(model, column, h, props.size, rest),
                h.Scope('col'),
                h.Attribute(
                  'aria-sort',
                  sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : 'none',
                ),
              ];
              if (column.id === 'select')
                return Table.head<Message>(
                  {
                    className: 'ff-data-table-cell',
                    attributes: [
                      ...attrs,
                      h.DataAttribute(
                        'check-revealed',
                        String(table.getIsAllRowsSelected() || table.getIsSomeRowsSelected()),
                      ),
                    ],
                    children: [
                      Checkbox.view(
                        {
                          id: `${model.id}-select-all`,
                          label: 'Select all rows',
                          checked: table.getIsAllRowsSelected(),
                          indeterminate: table.getIsSomeRowsSelected(),
                          onToggle: (selected) => Message.AllSelected({ selected }),
                          size: props.size,
                          radius: props.radius,
                        },
                        h,
                      ),
                    ],
                  },
                  h,
                );
              if (utilityColumns.has(column.id))
                return Table.head<Message>(
                  {
                    className: `ff-data-table-cell ${metaOf(column).className ?? ''}`,
                    attributes: attrs,
                    children: [],
                  },
                  h,
                );
              const drag = props.reorderColumns
                ? DragAndDrop.draggable(
                    {
                      model: model.columnDrag,
                      itemId: `${model.id}-column-${encodeURIComponent(column.id)}`,
                      containerId: model.columnDrag.id,
                      index: dataColumns.findIndex((c) => c.id === column.id),
                      toParentMessage: (message) =>
                        Message.ColumnDrag({ generation: model.generation, message }),
                    },
                    h,
                  )
                : [];
              const kind = filterOf(table, column);
              const canMenu =
                column.getCanSort() ||
                (props.filters && kind) ||
                props.reorderColumns ||
                column.getCanPin();
              const items = [
                ...(column.getCanSort()
                  ? [
                      {
                        label: 'Sort ascending',
                        value: action(
                          Message.Sorted({ columnId: column.id, multi: false, direction: 'asc' }),
                        ),
                      },
                      {
                        label: 'Sort descending',
                        value: action(
                          Message.Sorted({ columnId: column.id, multi: false, direction: 'desc' }),
                        ),
                      },
                      ...(sort
                        ? [
                            {
                              label: 'Clear sort',
                              value: action(
                                Message.Sorted({
                                  columnId: column.id,
                                  multi: false,
                                  direction: 'none',
                                }),
                              ),
                            },
                          ]
                        : []),
                    ]
                  : []),
                ...(props.filters && kind
                  ? [
                      {
                        label: 'Filter',
                        value: action(
                          Message.FilterChanged({
                            columnId: column.id,
                            value: column.getFilterValue() ?? emptyFilter(kind),
                          }),
                        ),
                      },
                    ]
                  : []),
                ...(props.reorderColumns
                  ? [
                      {
                        label: 'Move left',
                        value: action(Message.ColumnMoved({ columnId: column.id, direction: -1 })),
                        disabled: dataColumns[0]?.id === column.id,
                      },
                      {
                        label: 'Move right',
                        value: action(Message.ColumnMoved({ columnId: column.id, direction: 1 })),
                        disabled: dataColumns.at(-1)?.id === column.id,
                      },
                    ]
                  : []),
                ...(column.getCanPin()
                  ? [
                      {
                        label: column.getIsPinned() ? 'Unfreeze columns' : 'Freeze up to here',
                        value: action(
                          Message.ColumnPinned({
                            columnId: column.id,
                            side: column.getIsPinned() ? 'none' : 'left',
                          }),
                        ),
                      },
                    ]
                  : []),
              ];
              return Table.head<Message>(
                {
                  hoverIndex: !props.fill && canMenu ? index : undefined,
                  className: `ff-data-table-cell ${metaOf(column).className ?? ''}`,
                  attributes: [
                    ...attrs,
                    ...(canMenu ? [h.DataAttribute('head-action', '')] : []),
                    ...(model.menus[`header-${column.id}`]?.isOpen
                      ? [h.DataAttribute('held', '')]
                      : []),
                    ...(props.reorderColumns &&
                    model.rowDrag.dragState._tag === 'Idle' &&
                    !utilityColumns.has(column.id)
                      ? [
                          ...DragAndDrop.sortable(
                            `${model.id}-column-${encodeURIComponent(column.id)}`,
                          ),
                        ]
                      : []),
                  ],
                  children: [
                    h.div(
                      [h.Class('ff-data-table-heading')],
                      [
                        canMenu
                          ? Parts.menu(
                              model,
                              `header-${column.id}`,
                              {
                                label,
                                items,
                                chevron: false,
                                size: props.size,
                                radius: props.radius,
                                trigger: {
                                  attributes: childAttributes([
                                    h.Class('ff-data-table-header-trigger'),
                                    h.DataAttribute('sorted', String(!!sort)),
                                  ]),
                                  children: [
                                    h.span(
                                      [h.Class('ff-data-table-header-label')],
                                      [
                                        metaOf(column).icon
                                          ? icon(metaOf(column).icon!, props.icons, h)
                                          : null,
                                        label,
                                      ],
                                    ),
                                    column.getCanSort()
                                      ? h.span(
                                          [h.Class('ff-data-table-sort-glyph'), h.AriaHidden(true)],
                                          [
                                            h.span(
                                              [
                                                h.Class('ff-data-table-sort-arrow'),
                                                h.DataAttribute('sort', sort || 'none'),
                                                h.Style({
                                                  transform: `rotate(${sort === 'desc' ? 180 : 0}deg)`,
                                                }),
                                              ],
                                              [icon('arrow-up', props.icons, h)],
                                            ),
                                          ],
                                        )
                                      : null,
                                  ],
                                },
                              },
                              h,
                            )
                          : h.span([h.Class('ff-data-table-header-label')], [label]),
                        props.reorderColumns
                          ? Button.view<Message>(
                              {
                                label: `Move column ${label}`,
                                children: [icon('grip-vertical', props.icons, h)],
                                variant: 'ghost',
                                size: 'icon-compact',
                                radius: props.radius,
                                className: 'ff-data-table-column-handle',
                                attributes: drag.filter(
                                  (attribute) =>
                                    attribute._tag !== 'Role' &&
                                    !(
                                      attribute._tag === 'DataAttribute' &&
                                      attribute.key === 'sortable-id'
                                    ),
                                ),
                              },
                              h,
                            )
                          : null,
                      ],
                    ),
                    props.resizeColumns && column.getCanResize()
                      ? h.span(
                          [
                            h.Class('ff-data-table-resize'),
                            h.Role('separator'),
                            h.Tabindex(0),
                            h.AriaLabel(`Resize ${label}`),
                            h.Attribute('aria-orientation', 'vertical'),
                            h.Attribute('aria-valuenow', String(column.getSize())),
                            h.DataAttribute('resize-column', column.id),
                            h.OnDoubleClick(Message.ColumnReset({ columnId: column.id })),
                            h.OnKeyDownPreventDefault((key) =>
                              key === 'ArrowLeft' || key === 'ArrowRight'
                                ? Option.some(
                                    Message.ColumnResized({
                                      columnId: column.id,
                                      width: column.getSize() + (key === 'ArrowLeft' ? -16 : 16),
                                    }),
                                  )
                                : Option.none(),
                            ),
                          ],
                          [],
                        )
                      : null,
                  ],
                },
                h,
              );
            }),
          },
          h,
        ),
      ],
    },
    h,
  );
}
function valueText(value: unknown): string {
  return Array.isArray(value)
    ? value.join(', ')
    : value instanceof Date
      ? value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : String(value ?? '');
}
function bodyCell<T>(
  model: Model,
  props: Props<T>,
  row: Row<T>,
  column: Column<T>,
  dragIndex: number,
  tree: Tree.TreeCell,
  h: HtmlBuilder<Message>,
  rest?: string,
): Html {
  const value = row.getValue(column.id),
    editor = metaOf(column).editor;
  const rendered = props.renderCell ? props.renderCell(row.original, column.id) : valueText(value);
  let contents: readonly (Html | string)[] = [h.span([h.Class('ff-data-table-text')], [rendered])];
  if (column.id === 'select')
    contents = [
      Checkbox.view(
        {
          id: `${model.id}-select-${encodeURIComponent(row.id)}`,
          label: `Select row ${row.id}`,
          checked: row.getIsSelected(),
          indeterminate: !row.getIsSelected() && row.getIsSomeSelected(),
          disabled: !row.getCanSelect(),
          onToggle: (selected) => Message.RowSelected({ rowId: row.id, selected }),
          size: props.size,
          radius: props.radius,
        },
        h,
      ),
    ];
  else if (column.id === 'drag')
    contents =
      props.reorderRows && row.depth === 0
        ? [
            Button.view<Message>(
              {
                label: `Move row ${row.id}`,
                className: 'ff-data-table-row-handle',
                children: [icon('grip-vertical', props.icons, h)],
                variant: 'ghost',
                size: 'icon-compact',
                radius: props.radius,
                attributes: DragAndDrop.draggable(
                  {
                    model: model.rowDrag,
                    itemId: `${model.id}-row-${encodeURIComponent(row.id)}`,
                    containerId: model.rowDrag.id,
                    index: dragIndex,
                    toParentMessage: (message) =>
                      Message.RowDrag({ generation: model.generation, message }),
                  },
                  h,
                ).filter(
                  (attribute) =>
                    attribute._tag !== 'Role' &&
                    !(attribute._tag === 'DataAttribute' && attribute.key === 'sortable-id'),
                ),
              },
              h,
            ),
          ]
        : [];
  else if (column.id === 'actions')
    contents = [
      Parts.menu(
        model,
        `row-${row.id}`,
        {
          label: 'Row actions',
          trigger: Parts.iconTrigger(
            'Row actions',
            icon('more-horizontal', props.icons, h),
            props,
            h,
          ),
          icon: icon('more-horizontal', props.icons, h),
          chevron: false,
          placement: 'bottom-end',
          popupAttributes: childAttributes([h.DataAttribute('table-row-menu', '')]),
          size: props.size,
          radius: props.radius,
          items: (props.rowActions ?? []).map((item) => ({
            ...item,
            value: action(Message.RowAction({ rowId: row.id, action: item.value })),
          })),
        },
        h,
      ),
    ];
  else if (props.editable && editor) {
    const type = typeof editor === 'string' ? editor : editor.type;
    const changed = (value: unknown) =>
      Message.CellEdited({ rowId: row.id, columnId: column.id, value });
    const key = JSON.stringify([row.id, column.id]);
    if (type === 'select' && typeof editor === 'object' && editor.type === 'select') {
      contents = [
        Parts.select(
          model,
          `cell-${key}`,
          {
            label: `${column.columnDef.header ?? column.id} for row ${row.id}`,
            value: action(changed(value)),
            items: editor.options
              .map(optionOf)
              .map((o) => ({ label: o.label, value: action(changed(o.value)) })),
            variant: 'borderless',
            size: props.size,
            radius: props.radius,
            triggerTrailing: [],
            valueContent: props.renderCell ? rendered : undefined,
          },
          h,
        ),
      ];
    } else if (
      type === 'number' &&
      typeof editor === 'object' &&
      editor.type === 'number' &&
      editor.options?.length
    ) {
      const values = [
        ...new Set([...editor.options.map(String), ...(value == null ? [] : [String(value)])]),
      ];
      contents = [
        h.submodel({
          slotId: `number-${key}`,
          model: numberModel(model, key),
          view: Combobox.view,
          toParentMessage: (message) =>
            Message.Number({
              key,
              rowId: row.id,
              columnId: column.id,
              generation: model.generation,
              message,
            }),
          viewInputs: {
            items: values.map((value) => ({ value, label: value })),
            value: value == null ? undefined : String(value),
            label: `${column.columnDef.header ?? column.id} for row ${row.id}`,
            creatable: true,
            size: props.size,
            radius: props.radius,
            variant: 'borderless',
            icons: props.icons,
          },
        }),
      ];
    } else if (type === 'date') {
      const date =
        typeof value === 'string' && value
          ? new Date(`${value.slice(0, 10)}T12:00:00`)
          : value instanceof Date
            ? value
            : undefined;
      contents = [
        h.div(
          [h.Class('ff-data-table-date-editor')],
          [
            h.submodel({
              slotId: `date-${key}`,
              model: dateModel(model, key),
              view: DatePicker.view,
              toParentMessage: (message) =>
                Message.Date({
                  generation: model.generation,
                  key,
                  rowId: row.id,
                  columnId: column.id,
                  message,
                }),
              viewInputs: {
                controlled: true,
                value:
                  date && !Number.isNaN(date.getTime())
                    ? Calendar.single(Calendar.fromNative(date))
                    : Calendar.none(),
                label: `${column.columnDef.header ?? column.id} for row ${row.id}`,
                size: props.size,
                radius: props.radius,
                icons: props.icons,
                variant: 'ghost',
              },
            }),
          ],
        ),
      ];
    } else if (type === 'tags') {
      const settings = typeof editor === 'object' && editor.type === 'tags' ? editor : undefined;
      const values = Array.isArray(value) ? value.map(String) : [];
      contents = [
        h.submodel({
          slotId: `tags-${key}`,
          model: tagsModel(model, key),
          view: Combobox.Multi.view,
          toParentMessage: (message) =>
            Message.Tags({
              generation: model.generation,
              key,
              rowId: row.id,
              columnId: column.id,
              message,
            }),
          viewInputs: {
            values,
            items: [...new Set([...(settings?.options ?? []), ...values])].map((value) => ({
              value,
              label: value,
            })),
            label: `${column.columnDef.header ?? column.id} for row ${row.id}`,
            size: props.size,
            radius: props.radius,
            icons: props.icons,
            variant: 'borderless',
            creatable: settings?.creatable,
          },
        }),
      ];
    } else if (
      type === 'text' &&
      typeof editor === 'object' &&
      editor.type === 'text' &&
      editor.link &&
      model.linkEditor !== key
    ) {
      const text = valueText(value),
        href =
          props.linkHref?.(row.original, column.id, text) ??
          (/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
      contents = [
        h.div(
          [h.Class('ff-data-table-link-field'), h.DataAttribute('link-editor', key)],
          [
            h.a(
              [h.Href(href), h.Class('ff-data-table-link'), h.Attribute('aria-keyshortcuts', 'F2')],
              [text || editor.placeholder || ''],
            ),
          ],
        ),
      ];
    } else if (
      type === 'text' &&
      (model.columnLines[column.id] ?? metaOf(column).lines ?? 1) !== 1
    ) {
      contents = [
        Textarea.view(
          {
            id: `${model.id}-cell-${encodeURIComponent(key)}`,
            value: valueText(value),
            ariaLabel: `${column.columnDef.header ?? column.id} for row ${row.id}`,
            onInput: changed,
            size: props.size,
            radius: props.radius,
            attributes: [h.OnFocus(Message.EditStarted())],
          },
          h,
        ),
      ];
    } else
      contents = [
        Input.view(
          {
            id: `${model.id}-cell-${encodeURIComponent(key)}`,
            value: valueText(value),
            type: type === 'number' ? 'number' : 'text',
            onInput: (v) => changed(type === 'number' ? (v === '' ? null : Number(v)) : v),
            ariaLabel: `${column.columnDef.header ?? column.id} for row ${row.id}`,
            size: props.size,
            radius: props.radius,
            attributes: [
              h.OnFocus(Message.EditStarted()),
              ...(model.linkEditor === key ? [h.OnBlur(Message.LinkEditEnded())] : []),
            ],
          },
          h,
        ),
      ];
  }
  if (tree.columnId === column.id)
    contents = Tree.cell(model, row, props, tree.continues, contents, h);
  return Table.cell<Message>(
    {
      className: `ff-data-table-cell ${metaOf(column).className ?? ''}`,
      attributes: [
        ...cellAttributes(model, column, h, props.size, rest),
        ...(tree.columnId === column.id ? [h.DataAttribute('tree', '')] : []),
        ...(column.id === 'select'
          ? [
              h.DataAttribute(
                'check-revealed',
                String(row.getIsSelected() || row.getIsSomeSelected()),
              ),
            ]
          : []),
      ],
      children: contents,
    },
    h,
  );
}
export function table<T>(model: Model, props: Props<T>, h: HtmlBuilder<Message>): Html {
  const instance = engine(
      props,
      props.resizeColumns
        ? model.table
        : {
            ...model.table,
            columnSizing: { ...model.table.columnSizing, ...model.fittedWidths },
          },
    ),
    columns = drawnColumns(instance);
  const rows = displayedRows(instance, model.heldOrder);
  const carried = new Set(carriedRows(model, rows).map((row) => row.id));
  const dragIndices = new Map(
    rows.filter((row) => row.depth === 0).map((row, index) => [row.id, index]),
  );
  const heldHead = columns.findIndex((column) => model.menus[`header-${column.id}`]?.isOpen);
  const markers = markerColumns(columns, props);
  const rest = restColumn(instance, !!props.resizeColumns);
  const expanderId = instance.getCanSomeRowsExpand()
    ? columns.find((column) => !utilityColumns.has(column.id))?.id
    : undefined;
  const scroll = ScrollArea.decoration<Message>(
    {
      orientation: 'both',
      radius: props.radius,
      viewportFocusable: false,
      className: 'ff-data-table-frame',
      viewportClassName: 'ff-table ff-data-table-scroll ff-scroll-fade-x',
    },
    h,
  );
  const interactive =
    props.rowClickable ||
    props.editable ||
    props.reorderRows ||
    props.rowActions?.length ||
    columns.some((c) => c.id === 'select') ||
    !!props.getSubRows;
  const body = props.loading
    ? Array.from({ length: props.loadingRows ?? model.table.pagination.pageSize }, (_, i) =>
        Table.row<Message>(
          {
            children: columns.map((column, j) =>
              Table.cell<Message>(
                {
                  attributes: cellAttributes(model, column, h, props.size, rest),
                  children: [
                    h.span(
                      [h.Class('ff-data-table-skeleton-slot')],
                      [
                        h.span(
                          [
                            h.Class('ff-data-table-skeleton'),
                            h.AriaHidden(true),
                            h.Style({ width: `${[72, 56, 88, 64, 48, 80, 60][(i + j) % 7]}%` }),
                          ],
                          [],
                        ),
                      ],
                    ),
                  ],
                },
                h,
              ),
            ),
          },
          h,
        ),
      )
    : rows.length
      ? rows.map((row, index) =>
          Table.row<Message>(
            {
              index,
              attributes: [
                h.Key(row.id),
                h.Id(`${model.id}-row-${encodeURIComponent(row.id)}`),
                h.DataAttribute('row-id', row.id),
                h.DataAttribute('expandable', String(row.getCanExpand())),
                h.DataAttribute('expanded', String(row.getIsExpanded())),
                ...(row.parentId ? [h.DataAttribute('parent-id', row.parentId)] : []),
                h.DataAttribute('depth', String(row.depth)),
                h.DataAttribute('subrows-continue', String((rows[index + 1]?.depth ?? 0) > 0)),
                h.DataAttribute('selected', String(row.getIsSelected())),
                ...(carried.has(row.id) ? [h.DataAttribute('row-carried', '')] : []),
                ...(model.context?.rowId === row.id && ContextMenu.isOpen(model.contextMenu)
                  ? [h.DataAttribute('context-open', '')]
                  : []),
                h.DataAttribute(
                  'selectable',
                  String(row.getCanSelect() && columns.some((c) => c.id === 'select')),
                ),
                h.Attribute('aria-selected', String(row.getIsSelected())),
                ...(interactive ? [h.Tabindex(index === 0 ? 0 : -1)] : []),
              ],
              children: columns.map((column) =>
                bodyCell(
                  model,
                  props,
                  row,
                  column,
                  dragIndices.get(row.id) ?? -1,
                  { columnId: expanderId, continues: (rows[index + 1]?.depth ?? 0) > 0 },
                  h,
                  rest,
                ),
              ),
            },
            h,
          ),
        )
      : [
          Table.empty<Message>(
            {
              columns: Math.max(1, columns.length),
              title: props.empty?.title ?? 'No results',
              description:
                props.empty?.description ??
                (model.table.columnFilters.length ? 'Remove a filter to see more.' : undefined),
              rows: Math.max(1, Math.min(model.table.pagination.pageSize, props.data.length)),
              action:
                props.empty?.action ??
                (model.table.columnFilters.length
                  ? Button.view<Message>(
                      {
                        children: [
                          model.table.columnFilters.length === 1 ? 'Clear filter' : 'Clear filters',
                        ],
                        onClick: Message.FiltersCleared(),
                        variant: 'secondary',
                        size: props.size,
                        radius: props.radius,
                      },
                      h,
                    )
                  : undefined),
            },
            h,
          ),
        ];
  // A native row group supplies the SDK with the root's full physical height,
  // including its expanded descendants, without adding a collision owner.
  const groups: { id: string; children: Html[] }[] = [];
  if (!props.loading)
    rows.forEach((row, index) => {
      if (!groups.length || row.depth === 0) groups.push({ id: row.id, children: [] });
      groups[groups.length - 1]!.children.push(body[index]!);
    });
  const bodies = groups.length
    ? groups.map((group) =>
        Table.body<Message>(
          {
            attributes: [
              h.Key(group.id),
              h.DataAttribute('row-group', group.id),
              ...(props.reorderRows && model.columnDrag.dragState._tag === 'Idle'
                ? DragAndDrop.sortable(`${model.id}-row-${encodeURIComponent(group.id)}`)
                : []),
            ],
            children: group.children,
          },
          h,
        ),
      )
    : [Table.body<Message>({ children: body }, h)];
  const surface = Table.view<Message>(
    {
      size: props.size,
      radius: props.radius,
      snapKey: JSON.stringify(model.table.expanded),
      heldHeadIndex: props.fill || heldHead < 0 ? null : heldHead,
      hideHeadHighlight: DragAndDrop.isDragging(model.columnDrag),
      hoverMarkers: hoverMarkers(rows, columns, props, h),
      selectionMirrors: Frozen.frozenMirrorIds(model.id),
      onHighlightFrame: Frozen.highlightFrame,
      selectedIndices: props.loading
        ? []
        : rows.flatMap((row, index) =>
            row.getIsSelected() && !carried.has(row.id) ? [index] : [],
          ),
      hover:
        model.columnDrag.dragState._tag === 'Dragging' ? false : (props.rowHover ?? !!interactive),
      className: 'ff-data-table-element',
      attributes: [
        h.AriaLabel(props.label),
        h.Style({
          minWidth: `${instance.getTotalSize() - (props.size === 'compact' && columns.some((column) => column.id === 'actions') ? 4 : 0)}px`,
        }),
        h.Attribute('aria-busy', String(!!props.loading)),
        // Native table cells/table participate in hit-testing; row groups and
        // rows do not. Keep one active SDK container with only its sortables.
        ...(props.reorderRows || props.reorderColumns
          ? DragAndDrop.droppable(
              model.columnDrag.dragState._tag !== 'Idle' || !props.reorderRows
                ? model.columnDrag.id
                : model.rowDrag.id,
            ).filter((attribute) => attribute._tag !== 'Role')
          : []),
      ],
      wrapperAttributes: [
        ...scroll.viewportAttributes,
        h.DataAttribute('hold-row-highlight', String(model.rowDrag.dragState._tag === 'Dragging')),
        h.DataAttribute('frozen-id', model.id),
        h.DataAttribute(
          'selection-column',
          String(columns.some((column) => column.id === 'select')),
        ),
        h.DataAttribute('row-reorder', String(markers.reorder)),
        h.DataAttribute('carried-check', String(markers.boxLeft >= 0 && props.rowHover !== false)),
      ],
      children: [header(model, props, instance, h), ...bodies],
    },
    h,
  );
  return h.div(scroll.attributes, [
    surface,
    h.div(
      [
        h.Class('ff-data-table-frozen'),
        h.AriaHidden(true),
        h.Inert(true),
        h.OnMount(Frozen.Mounted()),
      ],
      [],
    ),
    ...scroll.tracks,
  ]);
}
export const create = <T>() => ({
  view: Submodel.defineView<Model, Message, Props<T>>((model, props, h) => {
    const original = engine(props, model.table);
    const instance = props.resizeColumns
      ? original
      : engine(props, {
          ...model.table,
          columnSizing: { ...model.table.columnSizing, ...model.fittedWidths },
        });
    const surface = Surface.withMessage(h);
    return surface(
      [
        surface.FfDataTableExpansion(JSON.stringify(model.table.expanded)),
        h.Class(`ff-data-table ${props.className ?? ''}`),
        h.Id(model.id),
        h.DataAttribute('generation', String(model.generation)),
        h.DataAttribute(
          'column-sizing',
          JSON.stringify(
            sizingConfig(
              original,
              props,
              model.generation,
              model.sizingFromSkeleton,
              model.columnLines,
            ),
          ),
        ),
        h.OnMount(Mounted()),
        h.DataAttribute('row-clickable', String(!!props.rowClickable)),
        h.DataAttribute('row-actions', String(!!props.rowActions?.length)),
        h.DataAttribute('reorder-columns', String(!!props.reorderColumns)),
        h.DataAttribute('selected-count', String(instance.getSelectedRowModel().flatRows.length)),
        h.DataAttribute('size', props.size ?? 'default'),
        h.DataAttribute('radius', props.radius ?? 'rounded'),
        h.DataAttribute('fill', String(!!props.fill)),
        h.DataAttribute(
          'align',
          props.cellAlign === 'auto' || !props.cellAlign
            ? instance
                .getVisibleLeafColumns()
                .some((c) => (model.columnLines[c.id] ?? metaOf(c).lines ?? 1) !== 1)
              ? 'top'
              : 'center'
            : props.cellAlign,
        ),
        h.OnUnmount(Message.Unmounted()),
      ],
      [
        props.renderToolbar
          ? props.renderToolbar()
          : props.title || props.filters || props.viewOptions || props.search
            ? h.div(
                [h.Class('ff-data-table-toolbar')],
                [
                  props.title ? Parts.title(props, instance, h) : null,
                  h.span([h.Class('ml-auto')], []),
                  h.div(
                    [h.Class('ff-data-table-tools')],
                    [
                      props.filters ? Parts.filters(model, props, instance, h) : null,
                      props.viewOptions ? Parts.viewOptions(model, props, instance, h) : null,
                      props.search ? Parts.search(model, props, h) : null,
                    ],
                  ),
                ],
              )
            : null,
        props.renderViews?.() ?? null,
        props.filters ? Parts.filterChips(model, props, instance, h) : null,
        table(model, props, h),
        props.pagination !== false ? Parts.pagination(model, props, instance, h) : null,
        props.selectionBar !== false ? Parts.selectionBar(model, props, instance, h) : null,
        ...ghosts(model, instance, h),
        model.context
          ? h.submodel({
              slotId: 'context-menu',
              model: model.contextMenu,
              view: ContextMenu.view,
              toParentMessage: (message) =>
                Message.ContextMenu({ generation: model.generation, message }),
              viewInputs: {
                label: 'Row actions',
                items: props.rowActions ?? [],
                size: props.size,
                radius: props.radius,
                triggers: [],
                menuWidth: 224,
              },
            })
          : null,
        model.actions.dialog.isOpen || model.actions.dialog.animation.transitionState !== 'Idle'
          ? h.submodel({
              slotId: 'selection-actions',
              model: model.actions,
              view: Actions.view,
              toParentMessage: (message) => Message.Actions({ message }),
              viewInputs: {
                title: 'Selection actions',
                items: props.selectionActions ?? [],
                placeholder: `Act on ${instance.getSelectedRowModel().flatRows.length} rows…`,
                size: props.size,
                radius: props.radius,
                icons: props.icons,
                footer: true,
              },
            })
          : null,
        model.confirmation.isOpen || model.confirmation.animation.transitionState !== 'Idle'
          ? h.submodel({
              slotId: 'confirm-move',
              model: model.confirmation,
              view: Dialog.view,
              toParentMessage: (message) => Message.ConfirmDialog({ message }),
              viewInputs: {
                title: 'Remove sorting to reorder rows?',
                description: 'The sort decides the row order. Remove it to keep your new order.',
                hideTrigger: true,
                size: props.size,
                radius: props.radius,
                icons: props.icons,
                renderFooter: () =>
                  h.div(
                    [h.Class('flex justify-end gap-2')],
                    [
                      Button.view<Message>(
                        {
                          children: ['Cancel'],
                          onClick: Message.MoveCancelled(),
                          variant: 'ghost',
                          size: props.size,
                          radius: props.radius,
                        },
                        h,
                      ),
                      Button.view<Message>(
                        {
                          children: ['Remove sorting and move'],
                          onClick: Message.MoveConfirmed(),
                          size: props.size,
                          radius: props.radius,
                        },
                        h,
                      ),
                    ],
                  ),
              },
            })
          : null,
      ],
    );
  }),
});

export * as History from './history';

export { ViewState, captureView, restoreView } from './views';
