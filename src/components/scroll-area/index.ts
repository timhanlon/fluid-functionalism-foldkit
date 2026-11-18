import type { Attribute, Html, HtmlBuilder } from 'foldkit/html';
import { ScrollArea } from './runtime';
import './styles.css';
export { mountScrollArea, ScrollArea as Mounted } from './runtime';
export interface Props<Message> {
  readonly children: readonly (Html | string)[];
  readonly orientation?: 'vertical' | 'horizontal' | 'both';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly label?: string;
  readonly className?: string;
  readonly viewportClassName?: string;
  /** False keeps the viewport out of the Tab order, for lists whose focus
   * stays in a field (a command menu's rows). Defaults to true. */
  readonly viewportFocusable?: boolean;
  readonly style?: string;
  readonly attributes?: readonly Attribute<Message>[];
}
/** Compose an existing native viewport (Table's surface, for example) with
 * the same scroll tracks and scoped runtime used by view. */
export function decoration<Message>(
  props: Omit<Props<Message>, 'children'>,
  h: HtmlBuilder<Message>,
) {
  const orientation = props.orientation ?? 'vertical';
  const bar = (axis: 'vertical' | 'horizontal') =>
    h.div(
      [
        h.Class('ff-scrollbar'),
        h.DataAttribute('slot', 'scroll-area-scrollbar'),
        h.DataAttribute('orientation', axis),
        h.AriaHidden(true),
      ],
      [h.div([h.Class('ff-scroll-thumb'), h.DataAttribute('slot', 'scroll-area-thumb')], [])],
    );
  return {
    attributes: [
      h.Class(`ff-scroll-area ${props.className ?? ''}`),
      h.DataAttribute('slot', 'scroll-area'),
      h.DataAttribute('scroll-orientation', orientation),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.OnMount(ScrollArea()),
      ...(props.style ? [h.Attribute('style', props.style)] : []),
      ...(props.attributes ?? []),
    ],
    viewportAttributes: [
      h.Class(`ff-scroll-viewport base-ui-disable-scrollbar ${props.viewportClassName ?? ''}`),
      h.DataAttribute('slot', 'scroll-area-viewport'),
      h.Tabindex(props.viewportFocusable === false ? -1 : 0),
      ...(props.viewportFocusable === false || !props.label ? [] : [h.Role('region')]),
      ...(props.label ? [h.AriaLabel(props.label)] : []),
    ],
    tracks: [
      ...(orientation !== 'horizontal' ? [bar('vertical')] : []),
      ...(orientation !== 'vertical' ? [bar('horizontal')] : []),
    ],
  };
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const parts = decoration(props, h);
  return h.div(parts.attributes, [
    h.div(parts.viewportAttributes, [h.div([h.Class('ff-scroll-content')], props.children)]),
    ...parts.tracks,
  ]);
}
