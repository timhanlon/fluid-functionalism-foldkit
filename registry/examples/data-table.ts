import { Option, Schema } from 'effect';
import { Command, Subscription, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as DataTable from './fluid/components/data-table';
import * as Button from './fluid/components/button';

interface Person {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
  readonly children?: readonly Person[];
}
const Person: Schema.Codec<Person> = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
  role: Schema.String,
  children: Schema.optionalKey(Schema.Array(Schema.suspend(() => Person))),
});
const rows: readonly Person[] = [
  { id: '1', name: 'Ada Brooks', email: 'ada@acme.co', role: 'Owner' },
  { id: '2', name: 'Kenji Mori', email: 'kenji@acme.co', role: 'Admin' },
  { id: '3', name: 'Lena Fischer', email: 'lena@acme.co', role: 'Editor' },
];
const treeRows: readonly Person[] = [
  {
    id: 'parent',
    name: 'Design',
    email: 'design@acme.co',
    role: 'Owner',
    children: [
      {
        id: 'branch',
        name: 'Work',
        email: 'work@acme.co',
        role: 'Admin',
        children: [{ id: 'grandchild', name: 'Draft', email: 'draft@acme.co', role: 'Editor' }],
      },
      { id: 'child', name: 'Readme', email: 'readme@acme.co', role: 'Viewer' },
    ],
  },
  { id: 'flat', name: 'Notes', email: 'notes@acme.co', role: 'Editor' },
];
const columns: readonly DataTable.ColumnDef<Person>[] = [
  DataTable.rowHandleColumn(),
  DataTable.selectColumn(),
  { accessorKey: 'name', header: 'Name', meta: { editor: 'text' } },
  { accessorKey: 'email', header: 'Email', meta: { editor: 'text' } },
  {
    accessorKey: 'role',
    header: 'Role',
    meta: { editor: { type: 'select', options: ['Owner', 'Admin', 'Editor', 'Viewer'] } },
  },
  DataTable.rowActionsColumn(),
];
const props = (
  data: readonly Person[],
  preferences = { fill: false, pinning: true, tree: false },
): DataTable.Props<Person> => ({
  label: preferences.tree ? 'Hierarchy' : 'Team',
  title: preferences.tree ? 'Hierarchy' : 'Team',
  fill: preferences.fill,
  enableColumnPinning: preferences.pinning,
  data,
  columns,
  getRowId: (row) => row.id,
  getSubRows: preferences.tree ? (row) => (row.children ? [...row.children] : []) : undefined,
  search: true,
  searchCollapsible: false,
  filters: true,
  viewOptions: true,
  editable: true,
  rowClickable: preferences.tree,
  resizeColumns: true,
  reorderColumns: true,
  reorderRows: true,
  pageSize: 2,
  rowActions: [{ value: 'remove', label: 'Remove', destructive: true }],
  selectionActions: [{ value: 'remove', label: 'Remove', destructive: true }],
});
export const Model = Schema.Struct({
  table: DataTable.Model,
  hierarchy: DataTable.Model,
  treeRows: Schema.Array(Person),
  tree: Schema.Boolean,
  opened: Schema.NullOr(Schema.String),
  rows: Schema.Array(Person),
  fill: Schema.Boolean,
  pinning: Schema.Boolean,
  shown: Schema.Boolean,
  moreRows: Schema.Boolean,
  savedView: Schema.NullOr(Schema.Struct({ tree: Schema.Boolean, state: DataTable.ViewState })),
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Table: { message: DataTable.Message },
  Hierarchy: { message: DataTable.Message },
  TreeToggled: {},
  FillToggled: {},
  PinningToggled: {},
  VisibilityToggled: {},
  RowCountToggled: {},
  ViewSaved: {},
  ViewRestored: {},
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    table: DataTable.init({ ...props(rows), id: 'team' }),
    hierarchy: DataTable.init({
      ...props(treeRows, { fill: false, pinning: true, tree: true }),
      id: 'hierarchy',
    }),
    treeRows,
    tree: false,
    opened: null,
    rows,
    fill: false,
    pinning: true,
    shown: true,
    moreRows: false,
    savedView: null,
  },
});
function editRows(
  data: readonly Person[],
  rowId: string,
  column: string,
  value: string,
): readonly Person[] {
  return data.map((row) => ({
    ...row,
    ...(row.id === rowId ? { [column]: value } : {}),
    ...(row.children ? { children: editRows(row.children, rowId, column, value) } : {}),
  }));
}
function removeRows(data: readonly Person[], ids: readonly string[]): readonly Person[] {
  return data
    .filter((row) => !ids.includes(row.id))
    .map((row) => (row.children ? { ...row, children: removeRows(row.children, ids) } : row));
}
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  if (message._tag === 'ViewSaved')
    return {
      model: {
        ...model,
        savedView: {
          tree: model.tree,
          state: DataTable.captureView(model.tree ? model.hierarchy : model.table),
        },
      },
    };
  if (message._tag === 'ViewRestored') {
    const view = model.savedView;
    if (!view) return { model };
    return {
      model: {
        ...model,
        tree: view.tree,
        ...(view.tree
          ? { hierarchy: DataTable.restoreView(model.hierarchy, view.state) }
          : { table: DataTable.restoreView(model.table, view.state) }),
      },
    };
  }
  if (message._tag === 'RowCountToggled') {
    const moreRows = !model.moreRows;
    const rows = moreRows
      ? [
          ...model.rows,
          ...Array.from({ length: 20 }, (_, index) => ({
            id: `sample-${index + 1}`,
            name: `Member ${index + 1}`,
            email: `member${index + 1}@acme.co`,
            role: 'Viewer',
          })),
        ]
      : model.rows.filter((row) => !row.id.startsWith('sample-'));
    const table = DataTable.update(
      model.table,
      DataTable.Message.PageSizeChanged({ size: moreRows ? 25 : 2 }),
      props(rows, model),
    ).model;
    return { model: { ...model, rows, moreRows, table } };
  }
  if (message._tag === 'TreeToggled') return { model: { ...model, tree: !model.tree } };
  if (message._tag === 'VisibilityToggled') return { model: { ...model, shown: !model.shown } };
  if (message._tag === 'FillToggled') return { model: { ...model, fill: !model.fill } };
  if (message._tag === 'PinningToggled') return { model: { ...model, pinning: !model.pinning } };
  const tree = message._tag === 'Hierarchy';
  const wrap = tree ? Message.Hierarchy : Message.Table;
  const data = tree ? model.treeRows : model.rows;
  const preferences = { ...model, tree };
  const result = DataTable.update(
    tree ? model.hierarchy : model.table,
    message.message,
    props(data, preferences),
  );
  const out = result.outMessage;
  let rows = data;
  if (out?._tag === 'RowsReordered') rows = DataTable.moveRows(rows, out, (row) => row.id);
  if (out?._tag === 'CellEdited' && typeof out.value === 'string') {
    const value = out.value;
    rows = editRows(rows, out.rowId, out.columnId, value);
  }
  if ((out?._tag === 'RowAction' || out?._tag === 'SelectionAction') && out.action === 'remove') {
    const ids = out._tag === 'RowAction' ? [out.rowId] : out.rowIds;
    rows = removeRows(rows, ids);
  }
  const table = DataTable.update(
    result.model,
    DataTable.Message.Synced(),
    props(rows, preferences),
  ).model;
  return {
    model: {
      ...model,
      ...(out?._tag === 'RowActivated' ? { opened: out.rowId } : {}),
      ...(tree ? { treeRows: rows, hierarchy: table } : { rows, table }),
    },
    commands: result.commands?.map((command) =>
      Command.mapMessage(command, (message) => wrap({ message })),
    ),
  };
}
function childSubscriptions(
  key: 'table' | 'hierarchy',
  toMessage: (message: DataTable.Message) => Message,
) {
  const entries = Subscription.lift(DataTable.subscriptions)<Model, Message>({
    read: (model) =>
      model.shown && model.tree === (key === 'hierarchy') ? Option.some(model[key]) : Option.none(),
    toParentMessage: toMessage,
  });
  return Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => [`${key}-${name}`, entry]),
  );
}
export const subscriptions = Subscription.aggregate(
  childSubscriptions('table', (message) => Message.Table({ message })),
  childSubscriptions('hierarchy', (message) => Message.Hierarchy({ message })),
);
const table = DataTable.create<Person>();
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'DataTable example',
    body: h.main(
      [h.Class('p-6')],
      [
        h.h1([], ['DataTable']),
        h.div(
          [h.Class('flex flex-wrap gap-2 my-2')],
          [
            model.savedView
              ? Button.view(
                  {
                    children: ['Restore saved view'],
                    onClick: Message.ViewRestored(),
                    variant: 'secondary',
                    size: 'compact',
                  },
                  h,
                )
              : null,
            model.tree
              ? null
              : Button.view(
                  {
                    children: [model.moreRows ? 'Show fewer rows' : 'Show more rows'],
                    onClick: Message.RowCountToggled(),
                    variant: 'secondary',
                    size: 'compact',
                  },
                  h,
                ),
            Button.view(
              {
                children: [model.fill ? 'Natural height' : 'Fill container'],
                onClick: Message.FillToggled(),
                variant: 'secondary',
                size: 'compact',
              },
              h,
            ),
            Button.view(
              {
                children: [model.pinning ? 'Disable freezing' : 'Allow freezing'],
                onClick: Message.PinningToggled(),
                variant: 'secondary',
                size: 'compact',
              },
              h,
            ),
            Button.view(
              {
                children: [model.shown ? 'Hide table' : 'Show table'],
                onClick: Message.VisibilityToggled(),
                variant: 'secondary',
                size: 'compact',
              },
              h,
            ),
          ],
        ),
        model.shown
          ? h.div(
              [
                h.Key(model.tree ? 'hierarchy' : 'table'),
                h.Style({ height: model.fill ? '360px' : 'auto' }),
              ],
              [
                h.submodel({
                  slotId: model.tree ? 'hierarchy' : 'table',
                  model: model.tree ? model.hierarchy : model.table,
                  view: table.view,
                  toParentMessage: (message) =>
                    model.tree ? Message.Hierarchy({ message }) : Message.Table({ message }),
                  viewInputs: {
                    ...props(model.tree ? model.treeRows : model.rows, model),
                    renderViews: () =>
                      Button.view(
                        {
                          children: [model.tree ? 'Flat rows' : 'Tree rows'],
                          onClick: Message.TreeToggled(),
                          variant: 'secondary',
                          size: 'compact',
                        },
                        h,
                      ),
                    renderFilterActions: () => {
                      const state = DataTable.captureView(
                        model.tree ? model.hierarchy : model.table,
                      );
                      return model.savedView?.tree === model.tree &&
                        JSON.stringify(model.savedView.state) === JSON.stringify(state)
                        ? null
                        : Button.view(
                            {
                              children: ['Save view'],
                              onClick: Message.ViewSaved(),
                              variant: 'ghost',
                            },
                            h,
                          );
                    },
                  },
                }),
              ],
            )
          : null,
        model.tree && model.opened ? h.p([h.Role('status')], [`Opened row ${model.opened}`]) : null,
        model.savedView ? h.p([h.Role('status'), h.AriaLabel('Saved view')], ['View saved']) : null,
      ],
    ),
  };
}
