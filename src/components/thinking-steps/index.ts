import { Disclosure } from '@foldkit/ui';
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { icon, type IconName } from '../icons';
import * as Badge from '../badge';
import { PanelMounted } from './collapse-runtime';
import { TriggerMounted } from './trigger-runtime';
import { Entered } from './entrance-runtime';
import './styles.css';
export type StepStatus = 'complete' | 'active' | 'pending';
type Attributes<Message> = readonly (Attribute<Message> | ChildAttribute)[];
export interface Props<Message> {
  readonly id: string;
  /** Parents own open state; initialize to true for the reference default. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => Message;
  readonly header?: readonly (Html | string)[];
  readonly children: readonly Html[];
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly attributes?: Attributes<Message>;
  readonly headerAttributes?: Attributes<Message>;
  readonly contentAttributes?: Attributes<Message>;
}
export interface HeaderProps<Message> {
  readonly open: boolean;
  readonly children?: readonly (Html | string)[];
  readonly icons?: string;
  /** Use the Disclosure button attribute bundle to retain native semantics. */
  readonly attributes: Attributes<Message>;
}
export function header<Message>(props: HeaderProps<Message>, h: HtmlBuilder<Message>): Html {
  const label = props.children ?? ['Thinking'];
  return h.div(
    [h.Class('ff-thinking-trigger-wrap'), h.OnMount(TriggerMounted())],

    [
      h.span([h.Class('ff-thinking-trigger-highlight'), h.AriaHidden(true)], []),
      h.button(
        [
          h.Class('ff-thinking-trigger'),
          ...props.attributes,
          h.DataAttribute('open', String(props.open)),
        ],
        [
          h.span(
            [h.Class('ff-thinking-trigger-label')],
            [
              h.span([h.Class('ff-thinking-trigger-reserve'), h.AriaHidden(true)], label),
              h.span([h.Class('ff-thinking-trigger-text')], label),
            ],
          ),
          h.span(
            [h.Class('ff-thinking-chevron'), h.AriaHidden(true)],
            [icon('chevron-right', props.icons, h)],
          ),
        ],
      ),
    ],
  );
}
export function content<Message>(
  props: { readonly children: readonly Html[]; readonly attributes?: Attributes<Message> },
  h: HtmlBuilder<Message>,
): Html {
  return h.div([h.Class('ff-thinking-content'), ...(props.attributes ?? [])], props.children);
}
function panel<Message>(
  props: {
    readonly open: boolean;
    readonly children: readonly Html[];
    readonly attributes: Attributes<Message>;
  },
  h: HtmlBuilder<Message>,
): Html {
  return h.div(
    [
      h.Class('ff-thinking-panel'),
      ...props.attributes,
      h.DataAttribute('open', String(props.open)),
      h.OnMount(PanelMounted()),
    ],
    [
      h.div(
        [h.Class('ff-thinking-panel-clip')],
        [h.div([h.Class('ff-thinking-panel-inner')], props.children)],
      ),
    ],
  );
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return Disclosure.view(
    {
      id: props.id,
      isOpen: props.open,
      onToggle: props.onOpenChange,
      toView: (attributes) =>
        h.div(
          [
            h.Class('ff-thinking-steps'),
            h.DataAttribute('size', props.size ?? 'default'),
            h.DataAttribute('radius', props.radius ?? 'rounded'),
            ...(props.attributes ?? []),
          ],
          [
            header(
              {
                open: props.open,
                children: props.header,
                icons: props.icons,
                attributes: [
                  ...attributes.button,
                  h.AriaControls(`${props.id}-panel`),
                  ...(props.headerAttributes ?? []),
                ],
              },
              h,
            ),
            panel(
              {
                open: props.open,
                attributes: attributes.panel,
                children: [
                  content({ children: props.children, attributes: props.contentAttributes }, h),
                ],
              },
              h,
            ),
          ],
        ),
    },
    h,
  );
}
export interface StepProps<Message> {
  readonly key?: string;
  readonly icon?: IconName;
  readonly icons?: string;
  readonly showIcon?: boolean;
  readonly label: string;
  readonly description?: string;
  readonly status?: StepStatus;
  readonly delay?: number;
  readonly isLast?: boolean;
  readonly children?: readonly (Html | string)[];
  readonly attributes?: Attributes<Message>;
}
export function step<Message>(props: StepProps<Message>, h: HtmlBuilder<Message>): Html {
  if (props.status === 'pending') return null;
  const active = props.status === 'active';
  return h.div(
    [
      ...(props.key ? [h.Key(props.key)] : []),
      h.Class('ff-thinking-step'),
      h.DataAttribute('status', props.status ?? 'complete'),
      h.OnMount(Entered({ kind: 'step', delay: props.delay ?? 0.08 })),
      ...(props.attributes ?? []),
    ],
    [
      h.div(
        [h.Class('ff-thinking-step-inner')],
        [
          h.div(
            [h.Class('ff-thinking-step-row')],
            [
              h.div(
                [h.Class('ff-thinking-step-icon-column')],
                [
                  h.div(
                    [h.Class('ff-thinking-step-icon')],
                    [
                      props.showIcon === false
                        ? h.span([h.Class('ff-thinking-dot'), h.AriaHidden(true)], [])
                        : icon(props.icon ?? 'dot', props.icons, h),
                    ],
                  ),
                  props.isLast
                    ? null
                    : h.div([h.Class('ff-thinking-connector'), h.AriaHidden(true)], []),
                ],
              ),
              h.div(
                [h.Class('ff-thinking-step-copy')],
                [
                  h.span(
                    [h.Class(`ff-thinking-step-label${active ? ' ff-thinking-step-shimmer' : ''}`)],
                    [props.label, active ? '…' : null],
                  ),
                  props.description
                    ? h.span([h.Class('ff-thinking-step-description')], [props.description])
                    : null,
                  ...(props.children ?? []),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
export interface DetailsProps<Message> {
  readonly id: string;
  /** Initialize to false for the reference default. Independent of the root. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => Message;
  readonly summary: string;
  readonly details?: readonly string[];
  readonly children?: readonly Html[];
  readonly icons?: string;
  readonly attributes?: Attributes<Message>;
}
export function details<Message>(props: DetailsProps<Message>, h: HtmlBuilder<Message>): Html {
  return Disclosure.view(
    {
      id: props.id,
      isOpen: props.open,
      onToggle: props.onOpenChange,
      toView: (attributes) =>
        h.div(
          [h.Class('ff-thinking-details'), ...(props.attributes ?? [])],
          [
            header(
              {
                open: props.open,
                children: [props.summary],
                icons: props.icons,
                attributes: [...attributes.button, h.AriaControls(`${props.id}-panel`)],
              },
              h,
            ),
            panel(
              {
                open: props.open,
                attributes: attributes.panel,
                children: [
                  h.div(
                    [h.Class('ff-thinking-detail-lines')],
                    [
                      ...(props.details ?? []).map((text) =>
                        h.span([h.Class('ff-thinking-detail-line')], [text]),
                      ),
                      ...(props.children ?? []),
                    ],
                  ),
                ],
              },
              h,
            ),
          ],
        ),
    },
    h,
  );
}
export function sources<Message>(
  props: { readonly children: readonly Html[]; readonly attributes?: Attributes<Message> },
  h: HtmlBuilder<Message>,
): Html {
  return h.div([h.Class('ff-thinking-sources'), ...(props.attributes ?? [])], props.children);
}
export function source<Message>(
  props: {
    readonly color?: Badge.Color;
    readonly delay?: number;
    readonly children: readonly (Html | string)[];
    readonly attributes?: Attributes<Message>;
  },
  h: HtmlBuilder<Message>,
): Html {
  return h.span(
    [
      h.Class('ff-thinking-source'),
      h.OnMount(Entered({ kind: 'source', delay: props.delay ?? 0 })),
      ...(props.attributes ?? []),
    ],
    [
      Badge.view(
        { variant: 'solid', size: 'sm', color: props.color ?? 'gray', children: props.children },
        h,
      ),
    ],
  );
}
export function image<Message>(
  props: {
    readonly src: string;
    readonly alt?: string;
    readonly caption?: string;
    readonly delay?: number;
    readonly attributes?: Attributes<Message>;
  },
  h: HtmlBuilder<Message>,
): Html {
  return h.div(
    [
      h.Class('ff-thinking-image'),
      h.OnMount(Entered({ kind: 'image', delay: props.delay ?? 0 })),
      ...(props.attributes ?? []),
    ],
    [
      h.img([h.Src(props.src), h.Alt(props.alt ?? '')]),
      props.caption ? h.span([h.Class('ff-thinking-image-caption')], [props.caption]) : null,
    ],
  );
}
