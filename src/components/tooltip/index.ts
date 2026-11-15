import { Submodel } from 'foldkit';
import type { ChildAttribute, Html } from 'foldkit/html';
import { CursorFollow } from './cursor';
import { Tooltip as Primitive } from '@foldkit/ui';
import { Model, Message, ControlledOpen } from './state';
import { Motion } from './runtime';
export { Model, Message, init, update, ControlledOpen, FinishExit, type InitConfig } from './state';
export type { OutMessage } from './state';
export * as Group from './group';
import './styles.css';
export interface Props {
  readonly content: string;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly sideOffset?: number;
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
      anchor: { placement: props.side ?? 'top', gap: props.sideOffset ?? 8, portal: true },
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
            ...(props.forceOpen !== undefined || model.forceOpen !== null
              ? [h.OnMount(ControlledOpen())]
              : []),
          ],
          [
            h.span(
              [h.Class('contents')],
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
                            h.DataAttribute('tooltip-version', String(model.version)),
                            h.DataAttribute('radius', props.radius ?? 'rounded'),
                            h.DataAttribute('side', props.side ?? 'top'),
                          ],
                          [
                            h.div(
                              [h.Class('ff-tooltip-label'), h.OnMount(Motion())],
                              props.rich ? props.rich() : [props.content],
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
