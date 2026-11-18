import { Effect, Option, Schema } from 'effect';
import { Command, Dom, Subscription, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { DragAndDrop } from '@foldkit/ui';
import type { TableState } from '@tanstack/table-core';
import * as Dropdown from '../dropdown';
import * as ContextMenu from '../context-menu';
import * as Dialog from '../dialog';
import * as Actions from '../command-menu/dialog';
import * as Select from '../select';
import * as Calendar from '../calendar';
import { Day } from '../calendar/dates';
import * as DatePicker from '../date-picker';
import * as Combobox from '../combobox';
import * as Tooltip from '../tooltip';
import { metaOf, displayedRows } from './engine';
import { placementAtBoundary } from './reorder';
import { dateFilterPresets, optionOf } from './filters';
import {
  engine,
  columnId,
  utilityColumns,
  drawnColumns,
  drawnOrder,
  setOrderKeepingFrozen,
} from './engine';
import type { Options, Props, ColumnLines } from './types';
import { sizingConfig } from './sizing';

// TanStack's state is plain data. Validate its boundary rather than retain an
// engine instance with closures, caches and imperative setters in the Model.
const TableStateSchema = Schema.declare<TableState>(
  (value): value is TableState =>
    typeof value === 'object' && value !== null && 'pagination' in value && 'columnSizing' in value,
);
export const Model = Schema.Struct({
  id: Schema.String,
  generation: Schema.Number,
  today: Day,
  dates: Schema.Record(Schema.String, DatePicker.Model),
  tags: Schema.Record(Schema.String, Combobox.Multi.Model),
  numbers: Schema.Record(Schema.String, Combobox.Model),
  table: TableStateSchema,
  fittedWidths: Schema.Record(Schema.String, Schema.Number),
  sizingFromSkeleton: Schema.Boolean,
  menus: Schema.Record(Schema.String, Dropdown.Model),
  tooltips: Schema.Record(Schema.String, Tooltip.Model),
  selects: Schema.Record(Schema.String, Select.Model),
  columnLines: Schema.Record(Schema.String, Schema.Literals([1, 2, 'wrap'])),
  filtersHidden: Schema.Boolean,
  searchOpen: Schema.Boolean,
  selectionAnchor: Schema.NullOr(Schema.String),
  context: Schema.NullOr(
    Schema.Struct({
      rowId: Schema.String,
      x: Schema.Number,
      y: Schema.Number,
      returnFocusId: Schema.String,
    }),
  ),
  contextMenu: ContextMenu.Model,
  confirmation: Dialog.Model,
  actions: Actions.Model,
  heldOrder: Schema.NullOr(Schema.Array(Schema.String)),
  linkEditor: Schema.NullOr(Schema.String),
  rowDrag: DragAndDrop.Model,
  columnDrag: DragAndDrop.Model,
  pendingMove: Schema.NullOr(
    Schema.Struct({
      rowIds: Schema.Array(Schema.String),
      targetId: Schema.String,
      place: Schema.Literals(['before', 'after']),
    }),
  ),
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Tooltip: {
    key: Schema.String,
    generation: Schema.optionalKey(Schema.Number),
    message: Tooltip.Message,
  },
  FilterDate: {
    key: Schema.String,
    columnId: Schema.String,
    generation: Schema.optionalKey(Schema.Number),
    message: DatePicker.Message,
  },
  Date: {
    generation: Schema.optionalKey(Schema.Number),
    key: Schema.String,
    rowId: Schema.String,
    columnId: Schema.String,
    message: DatePicker.Message,
  },
  Number: {
    key: Schema.String,
    rowId: Schema.String,
    columnId: Schema.String,
    generation: Schema.optionalKey(Schema.Number),
    message: Combobox.Message,
  },
  Tags: {
    generation: Schema.optionalKey(Schema.Number),
    key: Schema.String,
    rowId: Schema.String,
    columnId: Schema.String,
    message: Combobox.Multi.Message,
  },
  Sorted: {
    columnId: Schema.String,
    multi: Schema.Boolean,
    direction: Schema.optionalKey(Schema.Literals(['asc', 'desc', 'none'])),
  },
  Searched: { query: Schema.String, columnId: Schema.optionalKey(Schema.String) },
  SearchToggled: {},
  SearchBlurred: {},
  ContextRequested: {
    rowId: Schema.String,
    x: Schema.Number,
    y: Schema.Number,
    returnFocusId: Schema.String,
  },
  ContextMenu: { generation: Schema.optionalKey(Schema.Number), message: ContextMenu.Message },
  FocusRestored: {},
  FilterChanged: { columnId: Schema.String, value: Schema.Unknown },
  FilterRemoved: { columnId: Schema.String },
  FiltersCleared: {},
  FiltersToggled: {},
  RowSelected: {
    rowId: Schema.String,
    selected: Schema.Boolean,
    range: Schema.optionalKey(Schema.Boolean),
  },
  AllSelected: { selected: Schema.Boolean },
  SelectionCleared: {},
  RowExpanded: { rowId: Schema.String, expanded: Schema.optionalKey(Schema.Boolean) },
  PageChanged: { page: Schema.Number },
  PageSizeChanged: { size: Schema.Number },
  ColumnShown: { columnId: Schema.String, visible: Schema.Boolean },
  ColumnPinned: { columnId: Schema.String, side: Schema.Literals(['left', 'right', 'none']) },
  ColumnMoved: { columnId: Schema.String, direction: Schema.Literals([-1, 1]) },
  ColumnResized: { columnId: Schema.String, width: Schema.Number },
  ColumnsMeasured: {
    generation: Schema.Number,
    size: Schema.optionalKey(Schema.Literals(['default', 'compact'])),
    key: Schema.String,
    widths: Schema.Record(Schema.String, Schema.Number),
  },
  ColumnReset: { columnId: Schema.String },
  ColumnLinesChanged: { columnId: Schema.String, lines: Schema.Literals([1, 2, 'wrap']) },
  Menu: {
    generation: Schema.optionalKey(Schema.Number),
    key: Schema.String,
    message: Dropdown.Message,
  },
  Select: {
    generation: Schema.optionalKey(Schema.Number),
    key: Schema.String,
    message: Select.Message,
  },
  EditStarted: {},
  LinkEditStarted: { rowId: Schema.String, columnId: Schema.String },
  LinkEditEnded: {},
  EditEnded: {},
  CellEdited: { rowId: Schema.String, columnId: Schema.String, value: Schema.Unknown },
  RowActivated: { rowId: Schema.String },
  RowAction: { rowId: Schema.String, action: Schema.String },
  SelectionAction: { action: Schema.String },
  RowDrag: { generation: Schema.optionalKey(Schema.Number), message: DragAndDrop.Message },
  ColumnDrag: { generation: Schema.optionalKey(Schema.Number), message: DragAndDrop.Message },
  RowMoved: { rowId: Schema.String, direction: Schema.Literals([-1, 1]) },
  Actions: { message: Actions.Message },
  ActionsOpened: {},
  ConfirmDialog: { message: Dialog.Message },
  MoveConfirmed: {},
  MoveCancelled: {},
  Undo: {},
  Redo: {},
  Synced: {},
  Unmounted: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  CellEdited: { rowId: Schema.String, columnId: Schema.String, value: Schema.Unknown },
  RowActivated: { rowId: Schema.String },
  RowAction: { rowId: Schema.String, action: Schema.String },
  SelectionAction: { rowIds: Schema.Array(Schema.String), action: Schema.String },
  RowsReordered: {
    rowIds: Schema.Array(Schema.String),
    targetId: Schema.String,
    place: Schema.Literals(['before', 'after']),
  },
  Undo: {},
  Redo: {},
});
export type OutMessage = typeof OutMessage.Type;
export function init<T>(options: Options<T> & { readonly id: string }): Model {
  return {
    id: options.id,
    generation: 0,
    today: Calendar.fromNative(new Date()),
    dates: {},
    tags: {},
    numbers: {},
    table: engine(options).initialState,
    fittedWidths: {},
    sizingFromSkeleton: false,
    menus: {},
    tooltips: {},
    selects: {},
    columnLines: {},
    filtersHidden: options.filtersHidden ?? false,
    searchOpen: false,
    selectionAnchor: null,
    context: null,
    contextMenu: ContextMenu.init({ id: `${options.id}-context` }),
    confirmation: Dialog.init({ id: `${options.id}-confirm-move` }),
    actions: Actions.init({ id: `${options.id}-selection-actions` }),
    heldOrder: null,
    linkEditor: null,
    rowDrag: DragAndDrop.init({ id: `${options.id}-rows`, activationThreshold: 4 }),
    columnDrag: DragAndDrop.init({
      id: `${options.id}-columns`,
      orientation: 'Horizontal',
      activationThreshold: 4,
    }),
    pendingMove: null,
  };
}
export const menuModel = (model: Model, key: string) =>
  model.menus[key] ??
  Dropdown.init({ id: `${model.id}-g${model.generation}-menu-${encodeURIComponent(key)}` });
export const selectModel = (model: Model, key: string) =>
  model.selects[key] ??
  Select.init({ id: `${model.id}-g${model.generation}-select-${encodeURIComponent(key)}` });
export const tooltipModel = (model: Model, key: string) =>
  model.tooltips[key] ??
  Tooltip.init({ id: `${model.id}-g${model.generation}-tip-${encodeURIComponent(key)}` });
export const action = (message: Message): string => JSON.stringify(message);
export const rowSubscriptions = Subscription.lift({
  rowPointer: DragAndDrop.subscriptions.documentPointer,
  rowEscape: DragAndDrop.subscriptions.documentEscape,
  rowKeyboard: DragAndDrop.subscriptions.documentKeyboard,
})<Model, Message>({
  read: (model) => Option.some(model.rowDrag),
  toParentMessage: (message) => Message.RowDrag({ message }),
});
export const columnSubscriptions = Subscription.lift({
  columnPointer: DragAndDrop.subscriptions.documentPointer,
  columnEscape: DragAndDrop.subscriptions.documentEscape,
  columnKeyboard: DragAndDrop.subscriptions.documentKeyboard,
})<Model, Message>({
  read: (model) => Option.some(model.columnDrag),
  toParentMessage: (message) => Message.ColumnDrag({ message }),
});
export const subscriptions = Subscription.aggregate(rowSubscriptions, columnSubscriptions);

export const RestoreFocus = Command.define('DataTable.RestoreFocus', {
  args: { id: Schema.String },
  messages: [Message.FocusRestored],
  execute: ({ id }) =>
    Dom.focus(`#${CSS.escape(id)}`).pipe(
      Effect.catch(() => Effect.void),
      Effect.as(Message.FocusRestored()),
    ),
});

export function update<T>(
  model: Model,
  message: Message,
  props: Props<T>,
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (
    'generation' in message &&
    message.generation !== undefined &&
    message.generation !== model.generation
  )
    return { model };
  let next = model;
  const table = engine(props, model.table, (state) => {
    next = { ...next, table: state };
  });
  const selected = () =>
    table
      .getSelectedRowModel()
      .flatRows.filter((row) => !row.subRows.length)
      .map((row) => row.id);
  const resetPage = () => table.setPageIndex(0);
  const move = (
    rowIds: readonly string[],
    targetId: string,
    place: 'before' | 'after',
  ): Update.ReturnWithOutMessage<Model, Message, OutMessage> => {
    if (
      !props.reorderRows ||
      !table.getCoreRowModel().rowsById[targetId] ||
      rowIds.includes(targetId)
    )
      return { model: next };
    const pendingMove = { rowIds: [...rowIds], targetId, place };
    if (model.table.sorting.length) {
      const result = Dialog.update(model.confirmation, Dialog.Message.RequestedOpen());
      return {
        model: { ...next, pendingMove, confirmation: result.model },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (message) => Message.ConfirmDialog({ message })),
        ),
      };
    }
    return { model: next, outMessage: OutMessage.RowsReordered(pendingMove) };
  };
  switch (message._tag) {
    case 'Tooltip': {
      const result = Tooltip.update(tooltipModel(model, message.key), message.message);
      return {
        model: { ...model, tooltips: { ...model.tooltips, [message.key]: result.model } },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (child) =>
            Message.Tooltip({ generation: model.generation, key: message.key, message: child }),
          ),
        ),
      };
    }
    case 'FocusRestored':
      return { model };
    case 'ContextRequested': {
      if (!props.rowActions?.length || !table.getCoreRowModel().rowsById[message.rowId])
        return { model };
      const result = ContextMenu.update(
        model.contextMenu,
        ContextMenu.Message.Requested({
          x: message.x,
          y: message.y,
          triggerId: `${model.id}-row-${message.rowId}`,
          targetValue: message.rowId,
          returnFocusId: message.returnFocusId,
        }),
        { items: props.rowActions },
      );
      return {
        model: { ...model, context: message, contextMenu: result.model },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (message) =>
            Message.ContextMenu({ generation: model.generation, message }),
          ),
        ),
      };
    }
    case 'ContextMenu': {
      const result = ContextMenu.update(model.contextMenu, message.message, {
        items: props.rowActions ?? [],
      });
      const commands =
        result.commands?.map((command) =>
          Command.mapMessage(command, (message) =>
            Message.ContextMenu({ generation: model.generation, message }),
          ),
        ) ?? [];
      const selected = result.outMessages?.find((out) => out._tag === 'Selected');
      return {
        model: { ...model, contextMenu: result.model },
        commands,
        ...(selected?._tag === 'Selected' && model.context
          ? {
              outMessage: OutMessage.RowAction({
                rowId: model.context.rowId,
                action: selected.value,
              }),
            }
          : {}),
      };
    }

    case 'FilterDate': {
      const filter = table
        .getColumn(message.columnId)
        ?.getFilterValue() as import('./types').FilterValue;
      if (!filter || typeof filter !== 'object' || filter.kind !== 'date') return { model };
      const from = filter.from
        ? Calendar.fromNative(new Date(`${filter.from}T12:00:00`))
        : undefined;
      const to = filter.to ? Calendar.fromNative(new Date(`${filter.to}T12:00:00`)) : undefined;
      const result = DatePicker.update(dateModel(model, message.key), message.message, {
        typeable: true,
        mode: !filter.op || filter.op === 'between' ? 'range' : 'single',
        presets: !filter.op || filter.op === 'between' ? dateFilterPresets(model.today) : undefined,
        controlled: true,
        value:
          !filter.op || filter.op === 'between'
            ? Calendar.range(from, to)
            : (filter.op === 'before' ? to : from)
              ? Calendar.single((filter.op === 'before' ? to : from)!)
              : Calendar.none(),
      });
      next = { ...model, dates: { ...model.dates, [message.key]: result.model } };
      if (result.outMessage?._tag === 'ValueChanged') {
        const selected = result.outMessage.value;
        const iso = (day: Calendar.Day) =>
          `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
        table.getColumn(message.columnId)?.setFilterValue({
          ...filter,
          from:
            selected._tag === 'Range' && Option.isSome(selected.from)
              ? iso(selected.from.value)
              : selected._tag === 'Single' && filter.op === 'after'
                ? iso(selected.date)
                : undefined,
          to:
            selected._tag === 'Range' && Option.isSome(selected.to)
              ? iso(selected.to.value)
              : selected._tag === 'Single' && filter.op === 'before'
                ? iso(selected.date)
                : undefined,
        });
        table.setPageIndex(0);
      }
      return {
        model: next,
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (child) =>
            Message.FilterDate({
              key: message.key,
              columnId: message.columnId,
              generation: model.generation,
              message: child,
            }),
          ),
        ),
      };
    }
    case 'Date': {
      const child = dateModel(model, message.key);
      const row = table.getCoreRowModel().rowsById[message.rowId];
      const raw = row?.getValue(message.columnId);
      const date =
        typeof raw === 'string' && raw ? new Date(`${raw.slice(0, 10)}T12:00:00`) : undefined;
      const value =
        date && !Number.isNaN(date.getTime())
          ? Calendar.single(Calendar.fromNative(date))
          : Calendar.none();
      const result = DatePicker.update(child, message.message, { controlled: true, value });
      const base = { ...model, dates: { ...model.dates, [message.key]: result.model } };
      const commands = result.commands?.map((command) =>
        Command.mapMessage(command, (child) =>
          Message.Date({
            generation: model.generation,
            key: message.key,
            rowId: message.rowId,
            columnId: message.columnId,
            message: child,
          }),
        ),
      );
      const out = result.outMessage;
      const day =
        out?._tag === 'ValueChanged' && out.value._tag === 'Single' ? out.value.date : undefined;
      return {
        model: base,
        commands,
        ...(out?._tag === 'ValueChanged'
          ? {
              outMessage: OutMessage.CellEdited({
                rowId: message.rowId,
                columnId: message.columnId,
                value: day
                  ? `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`
                  : null,
              }),
            }
          : {}),
      };
    }
    case 'Number': {
      const row = table.getCoreRowModel().rowsById[message.rowId],
        column = table.getColumn(message.columnId);
      if (!row || !column || !props.editable) return { model };
      const editor = metaOf(column).editor;
      const options =
        typeof editor === 'object' && editor.type === 'number' ? (editor.options ?? []) : [];
      const raw = row.getValue(message.columnId),
        value = raw == null ? undefined : String(raw),
        old = numberModel(model, message.key);
      const items = [
        ...new Set([...options.map(String), ...(value === undefined ? [] : [value])]),
      ].map((value) => ({ value, label: value }));
      const result = Combobox.update(old, message.message, items, { value, creatable: true });
      const picked =
        result.outMessage?._tag === 'Selected'
          ? result.outMessage.value
          : result.outMessage?._tag === 'Created'
            ? result.outMessage.query
            : result.model.query !== old.query
              ? result.model.query
              : undefined;
      const parsed =
        picked === undefined ? undefined : picked.trim() === '' ? null : Number(picked);
      return {
        model: { ...model, numbers: { ...model.numbers, [message.key]: result.model } },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (child) =>
            Message.Number({
              key: message.key,
              rowId: message.rowId,
              columnId: message.columnId,
              generation: model.generation,
              message: child,
            }),
          ),
        ),
        ...(parsed !== undefined && (parsed === null || Number.isFinite(parsed))
          ? {
              outMessage: OutMessage.CellEdited({
                rowId: message.rowId,
                columnId: message.columnId,
                value: parsed,
              }),
            }
          : {}),
      };
    }
    case 'Tags': {
      const row = table.getCoreRowModel().rowsById[message.rowId],
        column = table.getColumn(message.columnId);
      if (!row || !column) return { model };
      const editor = metaOf(column).editor;
      const settings = typeof editor === 'object' && editor.type === 'tags' ? editor : undefined;
      const raw = row.getValue(message.columnId),
        values = Array.isArray(raw) ? raw.map(String) : [];
      const items = [...new Set([...(settings?.options ?? []), ...values])].map((value) => ({
        value,
        label: value,
      }));
      const result = Combobox.Multi.update(
        tagsModel(model, message.key),
        message.message,
        items,
        values,
        { creatable: settings?.creatable },
      );
      const out = result.outMessage;
      return {
        model: { ...model, tags: { ...model.tags, [message.key]: result.model } },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (child) =>
            Message.Tags({
              generation: model.generation,
              key: message.key,
              rowId: message.rowId,
              columnId: message.columnId,
              message: child,
            }),
          ),
        ),
        ...(out
          ? {
              outMessage: OutMessage.CellEdited({
                rowId: message.rowId,
                columnId: message.columnId,
                value: out._tag === 'Changed' ? out.values : [...values, out.query],
              }),
            }
          : {}),
      };
    }

    case 'Menu': {
      const child = menuModel(model, message.key);
      const result = Dropdown.update(child, message.message, {
        selection:
          message.key === 'columns' || message.key.startsWith('filter-options-')
            ? 'multiple'
            : undefined,
      });
      const base =
        result.model === child
          ? model
          : { ...model, menus: { ...model.menus, [message.key]: result.model } };
      const commands = result.commands?.map((command) =>
        Command.mapMessage(command, (child) =>
          Message.Menu({ generation: model.generation, key: message.key, message: child }),
        ),
      );
      if (result.outMessage?._tag !== 'Selected') return { model: base, commands };
      const selectedMessage = Schema.decodeUnknownSync(Message)(
        JSON.parse(result.outMessage.value),
      );
      const handled = update(base, selectedMessage, props);
      return { ...handled, commands: [...(commands ?? []), ...(handled.commands ?? [])] };
    }
    case 'Select': {
      const child = selectModel(model, message.key);
      const result = Select.update(child, message.message);
      const base =
        result.model === child
          ? model
          : { ...model, selects: { ...model.selects, [message.key]: result.model } };
      const commands = result.commands?.map((command) =>
        Command.mapMessage(command, (child) =>
          Message.Select({ generation: model.generation, key: message.key, message: child }),
        ),
      );
      if (result.outMessage?._tag !== 'Selected') return { model: base, commands };
      const value = result.outMessage.value;
      const selectedMessage =
        message.key === 'page-size'
          ? Message.PageSizeChanged({ size: Number(value) })
          : Schema.decodeUnknownSync(Message)(JSON.parse(value));
      const handled = update(base, selectedMessage, props);
      return { ...handled, commands: [...(commands ?? []), ...(handled.commands ?? [])] };
    }
    case 'Sorted':
      if (message.direction === 'none') table.getColumn(message.columnId)?.clearSorting();
      else
        table
          .getColumn(message.columnId)
          ?.toggleSorting(
            message.direction === undefined ? undefined : message.direction === 'desc',
            message.multi,
          );
      resetPage();
      break;
    case 'Searched':
      table.setGlobalFilter(
        message.columnId ? { column: message.columnId, query: message.query } : message.query,
      );
      resetPage();
      break;
    case 'SearchToggled':
      return {
        model: { ...model, searchOpen: !model.searchOpen },
        commands: model.searchOpen
          ? []
          : [RestoreFocus({ id: `${model.id}-g${model.generation}-search` })],
      };
    case 'SearchBlurred':
      return { model: { ...model, searchOpen: false } };
    case 'FilterChanged':
      next = { ...next, filtersHidden: false };
      table.getColumn(message.columnId)?.setFilterValue(message.value);
      resetPage();
      break;
    case 'FilterRemoved':
      table.getColumn(message.columnId)?.setFilterValue(undefined);
      resetPage();
      break;
    case 'FiltersCleared':
      table.resetColumnFilters(true);
      resetPage();
      break;
    case 'FiltersToggled':
      return { model: { ...model, filtersHidden: !model.filtersHidden } };
    case 'RowSelected': {
      const rows = table.getRowModel().rows;
      const anchor =
        model.selectionAnchor && rows.findIndex((row) => row.id === model.selectionAnchor);
      const to = rows.findIndex((row) => row.id === message.rowId);
      if (message.range && typeof anchor === 'number' && anchor >= 0 && to >= 0) {
        for (const row of rows.slice(Math.min(anchor, to), Math.max(anchor, to) + 1))
          row.toggleSelected(message.selected);
      } else table.getCoreRowModel().rowsById[message.rowId]?.toggleSelected(message.selected);
      next = {
        ...next,
        selectionAnchor:
          message.range && model.selectionAnchor ? model.selectionAnchor : message.rowId,
      };
      break;
    }
    case 'AllSelected':
      table.toggleAllRowsSelected(message.selected);
      break;
    case 'SelectionCleared':
      table.resetRowSelection(true);
      break;
    case 'RowExpanded':
      table.getCoreRowModel().rowsById[message.rowId]?.toggleExpanded(message.expanded);
      break;
    case 'PageChanged':
      table.setPageIndex(
        Math.max(0, Math.min(message.page, Math.max(0, table.getPageCount() - 1))),
      );
      break;
    case 'PageSizeChanged':
      if (Number.isInteger(message.size) && message.size > 0) table.setPageSize(message.size);
      break;
    case 'ColumnShown':
      if (!utilityColumns.has(message.columnId))
        table.getColumn(message.columnId)?.toggleVisibility(message.visible);
      break;
    case 'ColumnPinned': {
      if (utilityColumns.has(message.columnId)) break;
      if (message.side === 'none')
        table.setColumnPinning((old) => ({
          ...old,
          left: (old.left ?? []).filter((id) => utilityColumns.has(id)),
          right: (old.right ?? []).filter((id) => utilityColumns.has(id)),
        }));
      else if (message.side === 'left') {
        const right = new Set(table.getState().columnPinning.right ?? []);
        const ids = table
          .getVisibleLeafColumns()
          .map((c) => c.id)
          .filter((id) => !right.has(id));
        const at = ids.indexOf(message.columnId);
        if (at >= 0) table.setColumnPinning((old) => ({ ...old, left: ids.slice(0, at + 1) }));
      } else table.getColumn(message.columnId)?.pin('right');
      break;
    }
    case 'ColumnMoved': {
      if (utilityColumns.has(message.columnId)) break;
      const order = drawnOrder(table),
        movable = new Set(
          drawnColumns(table)
            .filter((c) => !utilityColumns.has(c.id))
            .map((c) => c.id),
        );
      const ids = order.filter((id) => movable.has(id));
      const from = ids.indexOf(message.columnId),
        to = from + message.direction;
      if (from < 0 || to < 0 || to >= ids.length) break;
      [ids[from], ids[to]] = [ids[to]!, ids[from]!];
      let nextSlot = 0;
      setOrderKeepingFrozen(
        table,
        order.map((id) => (movable.has(id) ? ids[nextSlot++]! : id)),
      );
      break;
    }
    case 'ColumnsMeasured': {
      if (props.size && message.size && props.size !== message.size) return { model };
      const config = sizingConfig(
        table,
        { ...props, size: message.size ?? props.size },
        model.generation,
        model.sizingFromSkeleton,
        model.columnLines,
      );
      if (
        message.key !== config.key ||
        Object.values(message.widths).some((width) => !Number.isFinite(width) || width <= 0)
      )
        return { model };
      if (props.resizeColumns) {
        if (config.seeded && !(config.guessed && !config.loading)) return { model };
        table.setColumnSizing((old) =>
          config.guessed ? message.widths : { ...message.widths, ...old },
        );
        next = { ...next, sizingFromSkeleton: config.loading };
      } else if (JSON.stringify(model.fittedWidths) !== JSON.stringify(message.widths)) {
        next = { ...next, fittedWidths: message.widths };
      }
      break;
    }
    case 'ColumnResized': {
      const column = table.getColumn(message.columnId);
      if (column && Number.isFinite(message.width))
        table.setColumnSizing((old) => ({
          ...old,
          [message.columnId]: Math.max(
            Math.max(48, column.columnDef.minSize ?? 0),
            Math.min(column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER, message.width),
          ),
        }));
      break;
    }
    case 'ColumnReset':
      table.setColumnSizing((old) => {
        const next = { ...old };
        delete next[message.columnId];
        return next;
      });
      break;
    case 'ColumnLinesChanged':
      return {
        model: {
          ...model,
          columnLines: { ...model.columnLines, [message.columnId]: message.lines },
        },
      };
    case 'LinkEditStarted': {
      if (!props.editable || !table.getCoreRowModel().rowsById[message.rowId]) return { model };
      const key = JSON.stringify([message.rowId, message.columnId]);
      return {
        model: {
          ...model,
          linkEditor: key,
          heldOrder: model.heldOrder ?? table.getRowModel().rows.map((r) => r.id),
        },
        commands: [RestoreFocus({ id: `${model.id}-cell-${encodeURIComponent(key)}` })],
      };
    }
    case 'LinkEditEnded':
      return { model: { ...model, linkEditor: null } };
    case 'EditStarted':
      return {
        model: model.heldOrder
          ? model
          : { ...model, heldOrder: table.getRowModel().rows.map((row) => row.id) },
      };
    case 'EditEnded':
      return {
        model:
          Object.values(model.selects).some((m) => m.listbox.isOpen) ||
          Object.values(model.dates).some((m) => m.popover.isOpen) ||
          Object.values(model.tags).some((m) => m.combo.isOpen) ||
          Object.values(model.numbers).some((m) => m.combo.isOpen)
            ? model
            : { ...model, heldOrder: null },
      };
    case 'CellEdited':
      return props.editable &&
        table.getColumn(message.columnId) &&
        metaOf(table.getColumn(message.columnId)!).editor &&
        table.getCoreRowModel().rowsById[message.rowId]
        ? { model, outMessage: OutMessage.CellEdited(message) }
        : { model };
    case 'RowActivated':
      return props.rowClickable
        ? { model, outMessage: OutMessage.RowActivated(message) }
        : { model };
    case 'RowAction':
      return { model, outMessage: OutMessage.RowAction(message) };
    case 'SelectionAction':
      return {
        model,
        outMessage: OutMessage.SelectionAction({ rowIds: selected(), action: message.action }),
      };
    case 'RowDrag': {
      const result = DragAndDrop.update(model.rowDrag, message.message);
      next = { ...model, rowDrag: result.model };
      const commands = result.commands?.map((command) =>
        Command.mapMessage(command, (message) =>
          Message.RowDrag({ generation: model.generation, message }),
        ),
      );
      if (
        result.outMessage?._tag !== 'Reordered' ||
        result.outMessage.toContainerId !== model.rowDrag.id ||
        result.outMessage.fromContainerId !== model.rowDrag.id
      )
        return { model: next, commands };
      const out = result.outMessage,
        rows = displayedRows(table, model.heldOrder).filter((row) => row.depth === 0);
      const row = rows.find(
        (row) => `${model.id}-row-${encodeURIComponent(row.id)}` === out.itemId,
      );
      const ids = row?.getIsSelected()
        ? rows.filter((r) => r.getIsSelected()).map((r) => r.id)
        : row
          ? [row.id]
          : [];
      const boundary =
        out.toIndex +
        (model.rowDrag.dragState._tag === 'KeyboardDragging' && out.toIndex > out.fromIndex
          ? 1
          : 0);
      const placement = placementAtBoundary(
        rows.map((row) => row.id),
        ids,
        boundary,
      );
      if (!placement) return { model: next, commands };
      const moved = move(ids, placement.targetId, placement.place);
      return { ...moved, commands: [...(commands ?? []), ...(moved.commands ?? [])] };
    }
    case 'ColumnDrag': {
      const result = DragAndDrop.update(model.columnDrag, message.message);
      next = { ...model, columnDrag: result.model };
      const commands = result.commands?.map((command) =>
        Command.mapMessage(command, (message) =>
          Message.ColumnDrag({ generation: model.generation, message }),
        ),
      );
      if (
        result.outMessage?._tag === 'Reordered' &&
        result.outMessage.toContainerId === model.columnDrag.id &&
        result.outMessage.fromContainerId === model.columnDrag.id
      ) {
        const ids = drawnColumns(table)
          .filter((column) => !utilityColumns.has(column.id))
          .map((column) => column.id);
        const out = result.outMessage;
        const id = ids.find((id) => `${model.id}-column-${encodeURIComponent(id)}` === out.itemId);
        const boundary =
          out.toIndex +
          (model.columnDrag.dragState._tag === 'KeyboardDragging' && out.toIndex > out.fromIndex
            ? 1
            : 0);
        const placement = id ? placementAtBoundary(ids, [id], boundary) : undefined;
        if (id && placement) {
          const reordered = moveRows(ids, { rowIds: [id], ...placement }, (id) => id);
          const visible = new Set(ids);
          let index = 0;
          setOrderKeepingFrozen(
            table,
            drawnOrder(table).map((id) => (visible.has(id) ? reordered[index++]! : id)),
          );
        }
      }
      return { model: next, commands };
    }
    case 'RowMoved': {
      const rows = displayedRows(table, model.heldOrder).filter((row) => row.depth === 0);
      const row = rows.find((row) => row.id === message.rowId);
      if (!row) return { model };
      const selected = rows.filter((row) => row.getIsSelected());
      const moving = selected.length ? selected : [row];
      const from = rows.indexOf(message.direction === -1 ? moving[0]! : moving[moving.length - 1]!);
      const target = rows[from + message.direction];
      return target
        ? move(
            moving.map((row) => row.id),
            target.id,
            message.direction === 1 ? 'after' : 'before',
          )
        : { model };
    }
    case 'ActionsOpened':
      return selected().length && props.selectionActions?.length
        ? update(model, Message.Actions({ message: Actions.Message.Opened() }), props)
        : { model };
    case 'Actions': {
      const result = Actions.update(model.actions, message.message, {
        items: props.selectionActions ?? [],
      });
      return {
        model: { ...model, actions: result.model },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (message) => Message.Actions({ message })),
        ),
        ...(result.outMessage?._tag === 'Selected'
          ? {
              outMessage: OutMessage.SelectionAction({
                rowIds: selected(),
                action: result.outMessage.value,
              }),
            }
          : {}),
      };
    }
    case 'ConfirmDialog': {
      const result = Dialog.update(model.confirmation, message.message);
      return {
        model: {
          ...model,
          confirmation: result.model,
          pendingMove: result.outMessage?._tag === 'Closed' ? null : model.pendingMove,
        },
        commands: result.commands?.map((command) =>
          Command.mapMessage(command, (message) => Message.ConfirmDialog({ message })),
        ),
      };
    }
    case 'MoveConfirmed': {
      if (!model.pendingMove) return { model };
      table.resetSorting(true);
      const closing = update(
        { ...next, pendingMove: null },
        Message.ConfirmDialog({ message: Dialog.Message.RequestedClose() }),
        props,
      );
      return { ...closing, outMessage: OutMessage.RowsReordered(model.pendingMove) };
    }
    case 'MoveCancelled':
      return update(
        { ...model, pendingMove: null },
        Message.ConfirmDialog({ message: Dialog.Message.RequestedClose() }),
        props,
      );
    case 'Undo':
      return { model, outMessage: OutMessage.Undo() };
    case 'Redo':
      return { model, outMessage: OutMessage.Redo() };
    case 'Synced': {
      const last = Math.max(0, table.getPageCount() - 1);
      if (model.table.pagination.pageIndex > last) table.setPageIndex(last);
      break;
    }
    case 'Unmounted':
      return {
        model: {
          ...model,
          heldOrder: null,
          generation: model.generation + 1,
          dates: {},
          tags: {},
          numbers: {},
          context: null,
          contextMenu: ContextMenu.init({ id: `${model.id}-g${model.generation + 1}-context` }),
          pendingMove: null,
          menus: {},
          tooltips: {},
          selects: {},
          rowDrag: DragAndDrop.init({ id: model.rowDrag.id }),
          columnDrag: DragAndDrop.init({ id: model.columnDrag.id, orientation: 'Horizontal' }),
        },
      };
  }
  return { model: next };
}

export function moveRows<T>(
  data: readonly T[],
  move: {
    readonly rowIds: readonly string[];
    readonly targetId: string;
    readonly place: 'before' | 'after';
  },
  getId: (row: T) => string,
): T[] {
  const ids = new Set(move.rowIds);
  if (ids.has(move.targetId)) return [...data];
  const rest = data.filter((row) => !ids.has(getId(row))),
    at = rest.findIndex((row) => getId(row) === move.targetId);
  if (at < 0) return [...data];
  const index = at + (move.place === 'after' ? 1 : 0);
  return [
    ...rest.slice(0, index),
    ...data.filter((row) => ids.has(getId(row))),
    ...rest.slice(index),
  ];
}

export const dateModel = (model: Model, key: string) =>
  model.dates[key] ??
  DatePicker.init({
    id: `${model.id}-g${model.generation}-date-${encodeURIComponent(key)}`,
    today: model.today,
  });
export const tagsModel = (model: Model, key: string) =>
  model.tags[key] ??
  Combobox.Multi.init({ id: `${model.id}-g${model.generation}-tags-${encodeURIComponent(key)}` });

export const numberModel = (model: Model, key: string) =>
  model.numbers[key] ??
  Combobox.init({ id: `${model.id}-g${model.generation}-number-${encodeURIComponent(key)}` });
