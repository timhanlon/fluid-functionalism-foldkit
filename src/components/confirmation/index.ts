import { Command, Submodel, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as Banner from '../banner';
import { icon, type IconName } from '../icons';
import './styles.css';

/** Fluid Functionalism f801409: a question in a Banner, with a parent-owned answer. */
export type State = 'requested' | 'approved' | 'denied';
export const Model = Banner.Model;
export type Model = Banner.Model;
export const init = Banner.init;
export const Message = defineMessageUnion({
  Banner: { message: Banner.Message },
  Approved: {},
  Denied: {},
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Approved: {},
  Denied: {},
  Dismissed: {},
  Hidden: {},
});
export type OutMessage = typeof OutMessage.Type;
export function update(
  model: Model,
  message: Message,
  options: { readonly controlled?: boolean } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message._tag !== 'Banner') return { model, outMessage: OutMessage[message._tag]() };
  const result = Banner.update(model, message.message, options);
  return {
    model: result.model,
    outMessage: result.outMessage ? OutMessage[result.outMessage._tag]() : undefined,
    commands: result.commands?.map((command) =>
      Command.mapMessage(command, (message) => Message.Banner({ message })),
    ),
  };
}
export interface Props extends Omit<
  Banner.Props,
  'role' | 'titleId' | 'descriptionId' | 'icon' | 'renderActions'
> {
  readonly state?: State;
  readonly icon?: IconName;
  readonly approveLabel?: string;
  readonly denyLabel?: string;
  readonly approvedLabel?: string;
  readonly deniedLabel?: string;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const state = props.state ?? 'requested';
  return h.submodel({
    slotId: 'banner',
    model,
    view: Banner.view,
    toParentMessage: (message) => Message.Banner({ message }),
    viewInputs: {
      ...props,
      role: 'group',
      titleId: `${model.id}-title`,
      descriptionId: `${model.id}-description`,
      icon: props.icon ? icon(props.icon, props.icons, h) : undefined,
      renderActions: () =>
        state === 'requested'
          ? [
              Banner.action(
                {
                  children: [props.approveLabel ?? 'Approve'],
                  variant: 'primary',
                  radius: props.radius,
                  onClick: Message.Approved(),
                },
                h,
              ),
              Banner.action(
                {
                  children: [props.denyLabel ?? 'Deny'],
                  variant: 'ghost',
                  radius: props.radius,
                  onClick: Message.Denied(),
                },
                h,
              ),
            ]
          : [
              h.span(
                [
                  h.Key(state),
                  h.Role('status'),
                  h.Class('ff-confirmation-answer'),
                  // f801409 declares an entry spring, but Banner's AnimatePresence
                  // initial={false} suppresses it. Match the observed immediate answer.
                ],
                [
                  icon(state === 'approved' ? 'check' : 'x', props.icons, h),
                  state === 'approved'
                    ? (props.approvedLabel ?? 'Approved')
                    : (props.deniedLabel ?? 'Denied'),
                ],
              ),
            ],
    },
  });
});
