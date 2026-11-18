import { Mount, Submodel } from 'foldkit';
import { Button } from '@foldkit/ui';
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { icon } from '../icons';
import { Message, type Model } from './state';
import { Mounted, ButtonMounted } from './runtime';
import './styles.css';
export { Model, Message, init, update } from './state';

export interface Props {
  readonly autoScroll?: boolean;
  readonly peek?: number;
  readonly label?: string;
  readonly className?: string;
  readonly viewportClassName?: string;
  readonly children?: readonly (Html | string)[];
  readonly renderContent?: () => readonly (Html | string)[];
  /** Compose the exported button yourself to control its placement or intercept its Message. */
  readonly showButton?: boolean;
  readonly buttonLabel?: string;
  readonly size?: 'default' | 'compact';
  readonly icons?: string;
}
export interface ContentProps<M> {
  readonly children: readonly (Html | string)[];
  readonly className?: string;
  readonly busy?: boolean;
  readonly attributes?: readonly (Attribute<M> | ChildAttribute)[];
}
export interface ItemProps<M> extends Omit<ContentProps<M>, 'busy'> {
  /** An arriving user turn glides under the top edge; rows present at mount are history. */
  readonly anchor?: boolean;
  readonly key?: string;
}
export interface ButtonProps<M> {
  readonly onClick: M;
  readonly toMessage: (message: Message) => M;
  readonly label?: string;
  readonly className?: string;
  readonly size?: 'default' | 'compact';
  readonly icons?: string;
}
export function content<M>(props: ContentProps<M>, h: HtmlBuilder<M>): Html {
  return h.div(
    [
      h.Class(`ff-ms-content ${props.className ?? ''}`),
      h.Key('message-content'),
      h.DataAttribute('ms-content', ''),
      h.Role('log'),
      ...(props.busy === undefined ? [] : [h.Attribute('aria-busy', String(props.busy))]),
      ...(props.attributes ?? []),
    ],
    props.children,
  );
}
export function item<M>(props: ItemProps<M>, h: HtmlBuilder<M>): Html {
  return h.div(
    [
      h.Class(`ff-ms-item ${props.className ?? ''}`),
      h.DataAttribute('ms-anchor', String(!!props.anchor)),
      ...(props.key ? [h.Key(props.key)] : []),
      ...(props.attributes ?? []),
    ],
    props.children,
  );
}
export function button<M>(model: Model, props: ButtonProps<M>, h: HtmlBuilder<M>): Html | null {
  if (!model.button.isShowing && model.button.transitionState === 'Idle') return null;
  return h.div(
    [
      h.Class('ff-ms-button-position'),
      h.Key('return-to-latest'),
      h.DataAttribute('ms-phase', model.button.transitionState),
      h.DataAttribute('ms-generation', String(model.button.transitionGeneration)),
      h.OnMount(Mount.mapMessage(ButtonMounted({ lifetime: model.lifetime }), props.toMessage)),
    ],
    [
      Button.view(
        {
          onClick: props.onClick,
          toView: ({ button }) =>
            h.button(
              [
                ...button,
                h.Class(`ff-ms-button ${props.className ?? ''}`),
                h.AriaLabel(props.label ?? 'Scroll to latest'),
                h.DataAttribute('size', props.size ?? 'default'),
              ],
              [icon('arrow-down', props.icons, h)],
            ),
        },
        h,
      ),
    ],
  );
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) =>
  h.div(
    [
      h.Id(model.id),
      h.Class(`ff-message-scroller ${props.className ?? ''}`),
      h.DataAttribute('message-scroller', ''),
      h.DataAttribute('ms-auto-scroll', String(props.autoScroll ?? true)),
      h.DataAttribute('ms-peek', String(props.peek ?? 16)),
      h.DataAttribute('ms-request', String(model.request)),
      h.OnMount(Mounted({ lifetime: model.lifetime })),
      h.OnUnmount(Message.Unmounted({ lifetime: model.lifetime })),
    ],
    [
      h.div(
        [
          h.Class(`ff-ms-viewport ${props.viewportClassName ?? ''}`),
          h.Key('viewport'),
          h.DataAttribute('ms-viewport', ''),
          h.Role('region'),
          h.AriaLabel(props.label ?? 'Conversation'),
          h.Tabindex(0),
        ],
        [
          ...(props.renderContent?.() ?? props.children ?? []),
          ...(props.showButton
            ? [
                button(
                  model,
                  {
                    onClick: Message.ScrollToEndRequested(),
                    toMessage: (message) => message,
                    label: props.buttonLabel,
                    size: props.size,
                    icons: props.icons,
                  },
                  h,
                ),
              ]
            : []),
          h.div(
            [
              h.Key('spacer'),
              h.DataAttribute('ms-spacer', ''),
              h.Class('ff-ms-spacer'),
              h.AriaHidden(true),
            ],
            [],
          ),
        ],
      ),
    ],
  ),
);
