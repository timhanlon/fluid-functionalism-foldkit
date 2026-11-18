import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Table from './fluid/components/table';

export const Model = Schema.Struct({
  ascending: Schema.Boolean,
  byOwner: Schema.Boolean,
  headHeld: Schema.Boolean,
  headHidden: Schema.Boolean,
  opened: Schema.String,
  expanded: Schema.Boolean,
  layoutVersion: Schema.Number,
  frameUnits: Schema.Literals(['pixels', 'rows']),
  reportFrames: Schema.Boolean,
  mirrorCount: Schema.Literals([0, 1, 2]),
  mirrorB: Schema.Boolean,
  markersShown: Schema.Boolean,
  markerMode: Schema.Literals(['labels', 'indices']),
  firstMarker: Schema.Boolean,
  rows: Schema.Boolean,
  hover: Schema.Boolean,
  shown: Schema.Boolean,
  selectedIndices: Schema.Array(Schema.Number),
  compact: Schema.Boolean,
  radius: Schema.Literals(['rounded', 'pill', 'sharp']),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Sorted: {},
  OwnerSorted: {},
  HeadHeldToggled: {},
  HeadHiddenToggled: {},
  RowOpened: { name: Schema.String },
  ExtraToggled: {},
  FrameUnitsToggled: {},
  FrameReportingToggled: {},
  MirrorTargetsChanged: { count: Schema.Literals([0, 1, 2]) },
  MirrorBToggled: {},
  MarkersToggled: {},
  MarkerModeToggled: {},
  FirstMarkerToggled: {},
  RowsToggled: {},
  HoverToggled: {},
  VisibilityToggled: {},
  SelectionChanged: { indices: Schema.Array(Schema.Number) },
  SizeToggled: {},
  RadiusChanged: { radius: Schema.Literals(['rounded', 'pill', 'sharp']) },
});
export type Message = typeof Message.Type;
export const init = (): { model: Model } => ({
  model: {
    ascending: true,
    byOwner: false,
    headHeld: false,
    headHidden: false,
    opened: '',
    expanded: false,
    layoutVersion: 0,
    frameUnits: 'pixels',
    reportFrames: true,
    mirrorCount: 2,
    mirrorB: true,
    markersShown: true,
    markerMode: 'labels',
    firstMarker: true,
    rows: true,
    hover: true,
    shown: true,
    selectedIndices: [],
    compact: false,
    radius: 'rounded',
  },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Sorted':
      return {
        model: { ...model, ascending: model.byOwner ? true : !model.ascending, byOwner: false },
      };
    case 'OwnerSorted':
      return {
        model: { ...model, ascending: model.byOwner ? !model.ascending : true, byOwner: true },
      };
    case 'HeadHeldToggled':
      return { model: { ...model, headHeld: !model.headHeld } };
    case 'HeadHiddenToggled':
      return { model: { ...model, headHidden: !model.headHidden } };
    case 'RowOpened':
      return { model: { ...model, opened: message.name } };
    case 'ExtraToggled':
      return {
        model: {
          ...model,
          expanded: !model.expanded,
          layoutVersion: model.layoutVersion + 1,
          selectedIndices: model.selectedIndices
            .map((index) => index + (model.expanded ? -1 : 1))
            .filter((index) => index >= 0),
        },
      };
    case 'FrameUnitsToggled':
      return { model: { ...model, frameUnits: model.frameUnits === 'pixels' ? 'rows' : 'pixels' } };
    case 'FrameReportingToggled':
      return { model: { ...model, reportFrames: !model.reportFrames } };
    case 'MirrorTargetsChanged':
      return { model: { ...model, mirrorCount: message.count } };
    case 'MirrorBToggled':
      return { model: { ...model, mirrorB: !model.mirrorB } };
    case 'MarkersToggled':
      return { model: { ...model, markersShown: !model.markersShown } };
    case 'MarkerModeToggled':
      return {
        model: { ...model, markerMode: model.markerMode === 'labels' ? 'indices' : 'labels' },
      };
    case 'FirstMarkerToggled':
      return { model: { ...model, firstMarker: !model.firstMarker } };
    case 'RowsToggled':
      return { model: { ...model, rows: !model.rows } };
    case 'HoverToggled':
      return { model: { ...model, hover: !model.hover } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
    case 'SelectionChanged':
      return { model: { ...model, selectedIndices: message.indices } };
    case 'SizeToggled':
      return { model: { ...model, compact: !model.compact } };
    case 'RadiusChanged':
      return { model: { ...model, radius: message.radius } };
  }
}

export function view(model: Model, h: HtmlBuilder<Message>) {
  const rows = [
    { name: 'Alpha', owner: 'Ada' },
    { name: 'Beta', owner: 'Ben' },
  ].sort((a, b) => {
    const field = model.byOwner ? 'owner' : 'name';
    return model.ascending ? a[field].localeCompare(b[field]) : b[field].localeCompare(a[field]);
  });
  const shownRows = model.expanded ? [{ name: 'Extra', owner: 'Details' }, ...rows] : rows;
  return {
    title: 'Table example',
    body: h.main(
      [],
      [
        h.h1([], ['Table']),
        model.shown
          ? Table.view(
              {
                hover: model.hover,
                selectedIndices: model.selectedIndices,
                hoverMarkers: model.markersShown
                  ? shownRows.flatMap((row, index) =>
                      !model.firstMarker && index === 0
                        ? []
                        : [
                            {
                              index,
                              content: h.span(
                                [
                                  h.Id(`table-marker-${row.name}`),
                                  h.Style({
                                    position: 'absolute',
                                    right: '8px',
                                    top: '0',
                                    bottom: '0',
                                    display: 'flex',
                                    alignItems: 'center',
                                    whiteSpace: 'nowrap',
                                    color:
                                      model.opened === row.name
                                        ? 'var(--foreground)'
                                        : 'var(--muted-foreground)',
                                  }),
                                ],
                                [
                                  `${model.opened === row.name ? '✓ ' : ''}${model.markerMode === 'labels' ? row.name : `Row ${index + 1}`}`,
                                ],
                              ),
                            },
                          ],
                    )
                  : [],
                selectionMirrors:
                  model.mirrorCount === 0
                    ? []
                    : ['table-mirror-a', ...(model.mirrorCount === 2 ? ['table-mirror-b'] : [])],
                snapKey: model.layoutVersion,
                onHighlightFrame: model.reportFrames
                  ? (box, element) => {
                      const output = element
                        .closest('main')
                        ?.querySelector('#table-frame-report') as HTMLOutputElement | null;
                      if (!output) return;
                      const position =
                        model.frameUnits === 'pixels'
                          ? `${box.y.toFixed(2)}px`
                          : `${(box.y / (model.compact ? 29 : 37)).toFixed(2)} rows`;
                      output.value = `${position} / ${box.height.toFixed(2)}px / ${box.opacity.toFixed(3)}`;
                      output.dataset.units = model.frameUnits;
                      output.dataset.surface = element.tagName;
                      output.dataset.y = String(box.y);
                      output.dataset.height = String(box.height);
                      output.dataset.opacity = String(box.opacity);
                      output.dataset.samples = String(Number(output.dataset.samples ?? '0') + 1);
                    }
                  : undefined,
                size: model.compact ? 'compact' : 'default',
                radius: model.radius,
                heldHeadIndex: model.headHeld ? 0 : null,
                hideHeadHighlight: model.headHidden,
                attributes: [h.AriaLabel('Projects')],
                children: [
                  Table.header(
                    {
                      children: [
                        Table.row(
                          {
                            children: [
                              Table.head(
                                {
                                  hoverIndex: 0,
                                  attributes: [
                                    h.Scope('col'),
                                    h.Attribute(
                                      'aria-sort',
                                      model.byOwner
                                        ? 'none'
                                        : model.ascending
                                          ? 'ascending'
                                          : 'descending',
                                    ),
                                  ],
                                  children: [
                                    h.button(
                                      [h.Type('button'), h.OnClick(Message.Sorted())],
                                      ['Sort by name'],
                                    ),
                                  ],
                                },
                                h,
                              ),
                              Table.head(
                                {
                                  hoverIndex: 1,
                                  attributes: [
                                    h.Scope('col'),
                                    h.Attribute(
                                      'aria-sort',
                                      model.byOwner
                                        ? model.ascending
                                          ? 'ascending'
                                          : 'descending'
                                        : 'none',
                                    ),
                                  ],
                                  children: [
                                    h.button(
                                      [h.Type('button'), h.OnClick(Message.OwnerSorted())],
                                      ['Sort by owner'],
                                    ),
                                  ],
                                },
                                h,
                              ),
                            ],
                          },
                          h,
                        ),
                      ],
                    },
                    h,
                  ),
                  Table.body(
                    {
                      children: model.rows
                        ? shownRows.map((row, index) =>
                            Table.row(
                              {
                                index,
                                attributes: [h.Key(row.name)],
                                children: [
                                  Table.cell(
                                    {
                                      children: [
                                        h.button(
                                          [
                                            h.Type('button'),
                                            h.AriaLabel(`Open ${row.name}`),
                                            h.OnClick(Message.RowOpened({ name: row.name })),
                                          ],
                                          [row.name],
                                        ),
                                      ],
                                    },
                                    h,
                                  ),
                                  Table.cell({ children: [row.owner] }, h),
                                ],
                              },
                              h,
                            ),
                          )
                        : [
                            Table.empty(
                              {
                                columns: 2,
                                title: 'No projects',
                                description: 'Add a project to begin.',
                                action: h.button(
                                  [h.Type('button'), h.OnClick(Message.RowsToggled())],
                                  ['Add projects'],
                                ),
                              },
                              h,
                            ),
                          ],
                    },
                    h,
                  ),
                ],
              },
              h,
            )
          : null,
        h.p([h.Role('status')], [model.opened ? `Opened ${model.opened}` : 'No project opened']),
        h.output(
          [
            h.Id('table-frame-report'),
            h.AriaLabel('Highlight frame'),
            h.Attribute('aria-live', 'off'),
          ],
          [],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.FrameUnitsToggled())],
          [model.frameUnits === 'pixels' ? 'Report in rows' : 'Report in pixels'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.FrameReportingToggled())],
          [model.reportFrames ? 'Stop frame reporting' : 'Start frame reporting'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.MarkerModeToggled())],
          [model.markerMode === 'labels' ? 'Use row indices' : 'Use row labels'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.MarkersToggled())],
          [model.markersShown ? 'Hide hover markers' : 'Show hover markers'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.FirstMarkerToggled())],
          [model.firstMarker ? 'Hide first marker' : 'Show first marker'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.ExtraToggled())],
          [model.expanded ? 'Collapse extra row' : 'Expand extra row'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.RowsToggled())],
          [model.rows ? 'Clear rows' : 'Restore rows'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.HoverToggled())],
          [model.hover ? 'Disable hover' : 'Enable hover'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide table' : 'Show table'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.HeadHeldToggled())],
          [model.headHeld ? 'Release held header' : 'Hold name header'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.HeadHiddenToggled())],
          [model.headHidden ? 'Show header fill' : 'Hide header fill'],
        ),
        ...[
          { label: 'Select first row', indices: [0] },
          { label: 'Select both rows', indices: [0, 1] },
          {
            label: 'Select alternating rows',
            indices: shownRows.flatMap((_, index) => (index % 2 === 0 ? [index] : [])),
          },
          { label: 'Select all shown rows', indices: shownRows.map((_, index) => index) },
          { label: 'Clear selection', indices: [] },
        ].map(({ label, indices }) =>
          h.button([h.Type('button'), h.OnClick(Message.SelectionChanged({ indices }))], [label]),
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.SizeToggled())],
          [model.compact ? 'Default size' : 'Compact size'],
        ),
        ...(['rounded', 'pill', 'sharp'] as const).map((radius) =>
          h.button(
            [h.Type('button'), h.OnClick(Message.RadiusChanged({ radius }))],
            [`Corners: ${radius}`],
          ),
        ),
        ...([0, 1, 2] as const).map((count) =>
          h.button(
            [h.Type('button'), h.OnClick(Message.MirrorTargetsChanged({ count }))],
            [`Mirror targets: ${count}`],
          ),
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.MirrorBToggled())],
          [model.mirrorB ? 'Remove mirror B' : 'Restore mirror B'],
        ),
        h.div(
          [
            h.Id('table-mirror-a'),
            h.AriaHidden(true),
            h.Style({
              position: 'relative',
              height: `${(shownRows.length + 1) * (model.compact ? 29 : 37)}px`,
              overflow: 'hidden',
              background: 'var(--background)',
            }),
          ],
          [h.span([], ['Mirror A'])],
        ),
        model.mirrorB
          ? h.div(
              [
                h.Id('table-mirror-b'),
                h.AriaHidden(true),
                h.Style({
                  position: 'relative',
                  height: `${(shownRows.length + 1) * (model.compact ? 29 : 37)}px`,
                  overflow: 'hidden',
                  background: 'var(--background)',
                }),
              ],
              [h.span([], ['Mirror B'])],
            )
          : null,
      ],
    ),
  };
}
