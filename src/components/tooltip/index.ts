import { Submodel } from 'foldkit';
import type { ChildAttribute, Html } from 'foldkit/html';
import { CursorFollow } from './cursor';
import { Tooltip as Primitive } from '@foldkit/ui';
import { Model, Message, ControlledOpen } from './state';
import { Motion } from './runtime';
import * as KeyCap from '../key-cap';
import { GroupMotion } from './group-runtime';
export { Model, Message, init, update, ControlledOpen, FinishExit, type InitConfig } from './state';
export type { OutMessage } from './state';
export * as Group from './group';
import './styles.css';
export interface Props {
  readonly content: string;
  /** A combo or explicit key names; caps do not increase the bubble's height. */
  readonly shortcut?: string | readonly string[];
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly sideOffset?: number;
  /** Keep the panel in the trigger’s overlay when it already escapes clipping. */
  readonly portal?: boolean;
  /** Also dismiss a pointer-opened, ungrouped tooltip on document Escape. */
  readonly dismissOnHoverEscape?: boolean;
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly renderTrigger: (attributes: readonly ChildAttribute[]) => Html;
  /** Rich content (bold verbs, key chips) in place of the plain string;
   * `content` stays the accessible text. */
  readonly rich?: () => readonly Html[];
  /** true forces open, false forces closed, undefined uses hover/focus. */
  readonly forceOpen?: boolean;
  /** Tracks the pointer along one axis while the other stays anchored by
   * `side` — upstream's followCursor, for tall or wide triggers. */
  readonly followCursor?: 'x' | 'y';
  /** Supplied by Group.tip; group state contains no browser resources. */
  readonly group?: {
    readonly id: string;
    readonly key: string;
    readonly lifetime: number;
    readonly side: 'top' | 'right' | 'bottom' | 'left' | null;
    readonly sideVersion: number;
  };
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) =>
  h.submodel({
    slotId: 'behavior',
    model:
      props.forceOpen === undefined || props.forceOpen === model.tooltip.isOpen
        ? model.tooltip
        : { ...model.tooltip, isOpen: props.forceOpen },
    view: Primitive.view,
    toParentMessage: (message) => Message.PrimitiveMessage({ message }),
    viewInputs: {
      anchor: {
        placement: props.group?.side ?? props.side ?? 'top',
        gap: props.sideOffset ?? 8,
        portal: props.portal ?? true,
      },
      isDisabled: props.disabled,
      ariaLabel: props.ariaLabel,
      toView: ({ trigger, panel, isVisible }) => {
        return h.span(
          [
            h.Class('ff-tooltip-anchor'),
            h.OnUnmount(Message.Unmounted()),
            h.DataAttribute(
              'tooltip-force-open',
              props.forceOpen === undefined ? 'auto' : String(props.forceOpen),
            ),
          ],
          [
            props.forceOpen !== undefined || model.forceOpen !== null
              ? h.span(
                  [
                    h.Key('controlled-open'),
                    h.Style({ display: 'none' }),
                    h.AriaHidden(true),
                    h.OnMount(ControlledOpen()),
                  ],
                  [],
                )
              : null,
            h.span(
              [h.Key('tooltip-content'), h.Class('contents')],
              [
                h.span(
                  [
                    h.Class('contents'),
                    h.DataAttribute('tooltip-follow-axis', props.followCursor ?? 'none'),
                    h.DataAttribute('tooltip-follow-forced', String(props.forceOpen === true)),
                    h.DataAttribute('tooltip-follow-panel', `${model.tooltip.id}-panel`),
                    ...(props.followCursor ? [h.OnMount(CursorFollow())] : []),
                  ],
                  [props.renderTrigger(trigger)],
                ),
                model.panelPresent || props.forceOpen
                  ? h.span(
                      [h.Class('contents')],
                      [
                        h.div(
                          [
                            ...panel,
                            h.Class('ff-tooltip'),
                            h.DataAttribute('closing', String(!isVisible)),
                            h.DataAttribute('hover-escape', String(!!props.dismissOnHoverEscape)),
                            h.DataAttribute('tooltip-version', String(model.version)),
                            h.DataAttribute('radius', props.radius ?? 'rounded'),
                            h.DataAttribute('side', props.group?.side ?? props.side ?? 'top'),
                          ],
                          [
                            h.div(
                              [
                                h.Class(props.group ? 'ff-tooltip-group-box' : 'ff-tooltip-label'),
                                ...(props.group
                                  ? [
                                      h.Key(`${props.group.id}:${props.group.lifetime}`),
                                      h.Style({ opacity: '0' }),
                                      h.DataAttribute('tooltip-group-id', props.group.id),
                                      h.DataAttribute('tooltip-group-key', props.group.key),
                                      h.DataAttribute(
                                        'tooltip-group-lifetime',
                                        String(props.group.lifetime),
                                      ),
                                      h.DataAttribute(
                                        'tooltip-group-side-version',
                                        String(props.group.sideVersion),
                                      ),
                                      h.OnMount(GroupMotion()),
                                    ]
                                  : [h.OnMount(Motion())]),
                              ],
                              props.group
                                ? [
                                    h.div([h.Class('ff-tooltip-shape'), h.AriaHidden(true)], []),
                                    h.div([h.Class('ff-tooltip-label')], tooltipContent(props, h)),
                                  ]
                                : tooltipContent(props, h),
                            ),
                          ],
                        ),
                      ],
                    )
                  : null,
              ],
            ),
          ],
        );
      },
    },
  }),
);

function tooltipContent(
  props: Props,
  h: import('foldkit/html').HtmlBuilder<Message>,
): readonly (Html | string)[] {
  return props.shortcut?.length
    ? [
        h.span(
          [h.Class('ff-tooltip-shortcut-row')],
          [
            h.span(
              [h.Class('ff-tooltip-shortcut-text')],
              props.rich ? props.rich() : [props.content],
            ),
            KeyCap.keys(
              {
                keys: props.shortcut,
                tone: 'inverted',
                className: 'ff-tooltip-shortcut',
              },
              h,
            ),
          ],
        ),
      ]
    : props.rich
      ? props.rich()
      : [props.content];
}
