import type { Attribute, Html, HtmlBuilder } from 'foldkit/html';
import { Mounted } from './runtime';
import { FrameSurface, type HighlightFrame } from './frame';
import { MarkerStore, type HoverMarker } from './marker';
import '../../fluid-hover/styles.css';
import './styles.css';
export { TABLE_HIGHLIGHT_EVENT } from './highlight-runtime';
export type { HighlightFrame } from './frame';
export type { HoverMarker } from './marker';
export interface Children<Message> {
  readonly children: readonly (Html | string)[];
  readonly className?: string;
  readonly attributes?: readonly Attribute<Message>[];
}
export interface Props<Message> extends Children<Message> {
  /** Declarative decorative slots corresponding to upstream hoverMarker(index).
   * Keep interactive controls in their rows. */
  readonly hoverMarkers?: readonly HoverMarker[];
  /** Current animated fill and native table surface. Write to the DOM; do not update Model per frame. */
  readonly onHighlightFrame?: (box: HighlightFrame, element: HTMLElement) => void;
  /** Parent-owned selected body row indices. Adjacent rows share one fill. */
  readonly selectedIndices?: readonly number[];
  /** IDs of mirror hosts in this containing root, positioned in table coordinates.
   * IDs replace upstream DOM refs so native elements stay out of Model. */
  readonly selectionMirrors?: readonly string[];
  /** Change with rows opening/closing above a fill so it jumps with their layout. */
  readonly snapKey?: string | number;
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  /** Suspend the independent header fill, for example during a column drag. */
  readonly hideHeadHighlight?: boolean;
  /** Header hoverIndex whose popup is open; it retains a pressed fill. */
  readonly heldHeadIndex?: number | null;
  /** Upstream follows the surrounding SizeProvider; Foldkit has no context, so
   * pass the docs or app size preference here (default 36px, compact 28px). */
  readonly size?: 'default' | 'compact';
  /** `false` suspends the row highlight (an inspector overlay, say) and
   * releases any lit row. Defaults to true. */
  readonly hover?: boolean;
  readonly wrapperAttributes?: readonly Attribute<Message>[];
}
/** The positioned wrapper owns the shared hover layer; the HTML table keeps
 * its native semantics and all consumer attributes. Size cascades to cells. */
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const surface = FrameSurface.withMessage(h);
  const store = MarkerStore.withMessage(h);
  return surface(
    [
      h.Class('ff-table'),
      surface.FfTableHighlightFrame(props.onHighlightFrame),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('selected-indices', (props.selectedIndices ?? []).join(',')),
      h.DataAttribute('selection-mirrors', JSON.stringify(props.selectionMirrors ?? [])),
      h.DataAttribute(
        'snap-key',
        props.snapKey === undefined ? '' : `${typeof props.snapKey}:${props.snapKey}`,
      ),
      h.DataAttribute('hover', props.hover === false ? 'off' : 'on'),
      h.DataAttribute('hide-head-highlight', String(!!props.hideHeadHighlight)),
      h.DataAttribute(
        'held-head-index',
        props.heldHeadIndex == null ? '' : String(props.heldHeadIndex),
      ),
      h.OnMount(Mounted()),
      ...(props.wrapperAttributes ?? []),
    ],
    [
      h.table(
        [h.Class(`ff-table-element ${props.className ?? ''}`), ...(props.attributes ?? [])],
        props.children,
      ),
      store(
        [
          h.Class('ff-table-markers'),
          store.FfTableMarkerRender({}),
          h.Style({ display: 'none' }),
          h.AriaHidden(true),
          h.Inert(true),
        ],
        (props.hoverMarkers ?? []).map((marker) =>
          h.div(
            [
              h.Key(String(marker.index)),
              h.DataAttribute('table-hover-marker', String(marker.index)),
            ],
            [marker.content],
          ),
        ),
      ),
      h.div([h.Class('ff-table-marker-carrier'), h.AriaHidden(true), h.Inert(true)], []),
    ],
  );
}
export function header<Message>(props: Children<Message>, h: HtmlBuilder<Message>): Html {
  return h.thead([h.Class(props.className ?? ''), ...(props.attributes ?? [])], props.children);
}
export function body<Message>(props: Children<Message>, h: HtmlBuilder<Message>): Html {
  return h.tbody([h.Class(props.className ?? ''), ...(props.attributes ?? [])], props.children);
}
export interface RowProps<Message> extends Children<Message> {
  /** Omit on header rows. Indexed rows join pointer and visible-focus highlights. */
  readonly index?: number;
  /** Keep a header's divider when the first body row is selected. */
  readonly keepRule?: boolean;
}
export function row<Message>(props: RowProps<Message>, h: HtmlBuilder<Message>): Html {
  return h.tr(
    [
      h.Class(`ff-table-row ${props.className ?? ''}`),
      ...(props.keepRule ? [h.DataAttribute('keep-rule', '')] : []),
      ...(props.index === undefined
        ? []
        : [h.DataAttribute('fluid-hover-index', String(props.index))]),
      ...(props.attributes ?? []),
    ],
    props.children,
  );
}
export interface HeadProps<Message> extends Children<Message> {
  /** Only actionable header cells join this horizontal visual scope. */
  readonly hoverIndex?: number;
}
export function head<Message>(props: HeadProps<Message>, h: HtmlBuilder<Message>): Html {
  return h.th(
    [
      h.Class(`ff-table-head ${props.className ?? ''}`),
      ...(props.hoverIndex === undefined
        ? []
        : [h.DataAttribute('head-hover', String(props.hoverIndex))]),
      ...(props.attributes ?? []),
    ],
    props.children,
  );
}
export function cell<Message>(props: Children<Message>, h: HtmlBuilder<Message>): Html {
  return h.td(
    [h.Class(`ff-table-cell ${props.className ?? ''}`), ...(props.attributes ?? [])],
    props.children,
  );
}
export interface EmptyProps<Message> {
  /** How many columns the message spans: the table's column count. */
  readonly columns: number;
  /** One short line saying what belongs here. */
  readonly title?: Html | string;
  /** One line on how rows get here. */
  readonly description?: Html | string;
  /** The control that creates the first row, e.g. a Button. */
  readonly action?: Html;
  /** The height to hold, in body rows, so filling the table doesn't shift
   * what sits under it. Defaults to 3. */
  readonly rows?: number;
  readonly children?: readonly (Html | string)[];
  readonly className?: string;
  readonly attributes?: readonly Attribute<Message>[];
}
/** Rendered in place of the body rows when there are none. It has no `index`,
 * so it never joins the hover; its height follows the cell padding. */
export function empty<Message>(props: EmptyProps<Message>, h: HtmlBuilder<Message>): Html {
  return h.tr(
    [
      h.DataAttribute('slot', 'table-empty'),
      ...(props.className ? [h.Class(props.className)] : []),
      ...(props.attributes ?? []),
    ],
    [
      h.td(
        [h.Class('ff-table-empty-cell'), h.Attribute('colspan', String(props.columns))],
        [
          h.div(
            [h.Class('ff-table-empty'), h.Style({ '--table-empty-rows': String(props.rows ?? 3) })],
            [
              props.title === undefined
                ? null
                : h.span([h.Class('ff-table-empty-title')], [props.title]),
              props.description === undefined
                ? null
                : h.span([h.Class('ff-table-empty-description')], [props.description]),
              ...(props.children ?? []),
              props.action === undefined
                ? null
                : h.div([h.Class('ff-table-empty-action')], [props.action]),
            ],
          ),
        ],
      ),
    ],
  );
}
