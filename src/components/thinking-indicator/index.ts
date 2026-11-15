import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { circleA, words } from './data';
import { Mounted } from './runtime';
import './styles.css';
export interface Props<Message> {
  readonly showIcon?: boolean;
  readonly size?: 'default' | 'compact';
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
/** All cycling visuals are aria-hidden: the status announces Thinking… once.
 * The mounted visual runtime owns morphing/cycling and cleans up on removal. */
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const compact = props.size === 'compact';
  return h.div(
    [
      h.Class('ff-thinking-indicator'),
      h.Role('status'),
      h.DataAttribute('size', props.size ?? 'default'),
      h.OnMount(Mounted()),
      ...(props.attributes ?? []),
    ],
    [
      h.span([h.Class('sr-only')], ['Thinking…']),
      props.showIcon === false
        ? null
        : h.svg(
            [
              h.Class('ff-thinking-glyph'),
              h.Width(compact ? '18' : '20'),
              h.Height(compact ? '18' : '20'),
              h.ViewBox('0 0 24 24'),
              h.Fill('none'),
              h.Stroke('currentColor'),
              h.StrokeWidth('1.5'),
              h.StrokeLinecap('round'),
              h.StrokeLinejoin('round'),
              h.AriaHidden(true),
            ],
            [h.path([h.D(circleA)], [])],
          ),
      h.span(
        [h.Class('ff-thinking-labels'), h.AriaHidden(true)],
        [
          h.span([h.Class('ff-thinking-reserve ff-thinking-shimmer')], ['Moonwalking']),
          h.span([h.Class('ff-thinking-current ff-thinking-shimmer')], [words[0]]),
        ],
      ),
    ],
  );
}
