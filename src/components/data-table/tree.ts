// Fluid Functionalism f801409, registry/default/data-table.tsx SubRowGuides/ExpandToggle.
import type { Row } from '@tanstack/table-core';
import type { Html, HtmlBuilder } from 'foldkit/html';
import * as Button from '../button';
import * as Tooltip from '../tooltip';
import { icon } from '../icons';
import { Message, tooltipModel, type Model } from './state';
import type { Props } from './types';
import './tree.css';

export interface TreeCell {
  readonly columnId: string | undefined;
  readonly continues: boolean;
}
export function cell<T>(
  model: Model,
  row: Row<T>,
  props: Props<T>,
  continues: boolean,
  content: readonly (Html | string)[],
  h: HtmlBuilder<Message>,
): readonly Html[] {
  const expandable = row.getCanExpand(),
    expanded = row.getIsExpanded();
  const guide = (part: string) =>
    h.span(
      [
        h.Class(`ff-data-table-tree-guide ff-data-table-tree-guide-${part}`),
        h.AriaHidden(true),
        h.DataAttribute('continues', String(continues)),
        h.DataAttribute('chevron', String(row.subRows.length > 0)),
      ],
      [],
    );
  const count = row.subRows.length,
    action = expanded ? 'Collapse' : 'Expand';
  const key = `expand-${row.id}`;
  const toggle = expandable
    ? h.submodel({
        slotId: `tip-${key}`,
        model: tooltipModel(model, key),
        view: Tooltip.view,
        toParentMessage: (message) =>
          Message.Tooltip({ generation: model.generation, key, message }),
        viewInputs: {
          content: `${action} ${count}`,
          side: 'top',
          radius: props.radius,
          renderTrigger: (attributes) =>
            Button.view(
              {
                label: `${action} ${count} ${count === 1 ? 'sub-row' : 'sub-rows'}`,
                children: [
                  h.span(
                    [
                      h.Class('ff-data-table-expander-chevron'),
                      h.DataAttribute('expanded', String(expanded)),
                    ],
                    [icon('chevron-right', props.icons, h)],
                  ),
                ],
                variant: 'ghost',
                size: 'icon-compact',
                radius: props.radius,
                className: 'ff-data-table-expander',
                onClick: Message.RowExpanded({ rowId: row.id }),
                attributes: [...attributes, h.Tabindex(-1), h.AriaExpanded(expanded)],
              },
              h,
            ),
        },
      })
    : h.span([h.Class('ff-data-table-expander-space'), h.AriaHidden(true)], []);
  return [
    ...(row.depth > 0 ? [guide('above')] : []),
    ...(row.subRows.length && (expanded || (row.depth > 0 && continues)) ? [guide('below')] : []),
    h.div(
      [h.Class('ff-data-table-tree')],
      [
        h.span([h.Class('ff-data-table-expander-slot')], [toggle]),
        h.span([h.Class('ff-data-table-tree-value')], content),
      ],
    ),
  ];
}
