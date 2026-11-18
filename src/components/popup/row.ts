import type { Html, HtmlBuilder } from 'foldkit/html';
import * as KeyCap from '../key-cap';
import { Leading } from './leading';

/** Common row projection; the enclosing primitive supplies role and state. */
export function rowContent<Message>(
  props: {
    readonly label: string;
    readonly destructive?: boolean;
    readonly icon?: Html;
    readonly leading?: Html;
    readonly check?: boolean;
    readonly trailing?: Html;
    readonly shortcut?: string | readonly string[];
  },
  h: HtmlBuilder<Message>,
): Html {
  return h.span(
    [
      h.Class('ff-popup-row-content'),
      ...(props.destructive ? [h.DataAttribute('destructive', '')] : []),
    ],
    [
      props.leading
        ? h.span([h.Class('ff-popup-row-leading'), h.OnMount(Leading())], [props.leading])
        : null,
      props.icon ? h.span([h.Class('ff-popup-row-icon'), h.AriaHidden(true)], [props.icon]) : null,
      h.span([h.Class('ff-popup-row-label')], [props.label]),
      props.trailing
        ? h.span(
            [h.Class('ff-popup-row-icon ff-popup-row-trailing'), h.AriaHidden(true)],
            [props.trailing],
          )
        : null,
      props.check
        ? h.span(
            [h.Class('ff-popup-row-check'), h.AriaHidden(true)],
            [
              h.svg(
                [
                  h.Attribute('viewBox', '0 0 24 24'),
                  h.Attribute('fill', 'none'),
                  h.Attribute('stroke', 'currentColor'),
                  h.Attribute('stroke-width', '2'),
                  h.Attribute('stroke-linecap', 'round'),
                  h.Attribute('stroke-linejoin', 'round'),
                ],
                [h.path([h.Attribute('d', 'M4 12L9 17L20 6'), h.Attribute('pathLength', '1')], [])],
              ),
            ],
          )
        : null,
      props.shortcut?.length
        ? KeyCap.keys({ keys: props.shortcut, attributes: [h.AriaHidden(true)] }, h)
        : null,
    ],
  );
}
