import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { Model, Message, tooltipModel } from './group-state';
import { GroupMounted } from './group-runtime';
import { view as tooltipView, type Props as TooltipProps } from './index';
export * from './group-state';
export interface Props<M> {
  readonly children: readonly (Html | string)[];
  readonly toMessage: (message: Message) => M;
  readonly className?: string;
}
export function view<M>(model: Model, props: Props<M>, h: HtmlBuilder<M>): Html {
  return h.span(
    [
      h.Id(model.id),
      h.Key(`${model.id}:${model.lifetime}`),
      h.Class(`ff-tooltip-group ${props.className ?? ''}`),
      h.DataAttribute('tooltip-group-side', model.side ?? 'none'),
      h.DataAttribute('tooltip-group-lifetime', String(model.lifetime)),
      h.OnMount(Mount.mapMessage(GroupMounted({ lifetime: model.lifetime }), props.toMessage)),
      h.OnUnmount(props.toMessage(Message.Unmounted({ lifetime: model.lifetime }))),
    ],
    props.children,
  );
}
export function tip<M>(
  model: Model,
  key: string,
  props: TooltipProps,
  toMessage: (message: Message) => M,
  h: HtmlBuilder<M>,
): Html {
  return h.submodel({
    slotId: `${model.id}-${key}`,
    model: tooltipModel(model, key),
    view: tooltipView,
    toParentMessage: (message) =>
      toMessage(Message.Tip({ key, message, lifetime: model.lifetime })),
    viewInputs: {
      ...props,
      group: {
        id: model.id,
        key,
        lifetime: model.lifetime,
        side: model.side,
        sideVersion: model.sideVersion,
      },
    },
  });
}
