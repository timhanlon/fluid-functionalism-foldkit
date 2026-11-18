import { Submodel } from 'foldkit';
import { childAttributes, type ChildAttribute, type Html } from 'foldkit/html';
import * as Tree from '../dropdown/tree';
import { Mounted, AnchorPortal } from './runtime';
import { Message, type Model } from './state';
import './styles.css';
export {
  Model,
  Message,
  OutMessage,
  init,
  update,
  RestoreFocus,
  type Result,
  type UpdateOptions,
} from './state';
export type Item = Tree.Item;
export interface Trigger {
  readonly id: string;
  readonly disabled?: boolean;
}
export interface Props extends Omit<
  Tree.Props,
  'trigger' | 'anchorTriggerId' | 'hideTrigger' | 'placement' | 'anchorGap'
> {
  /** Each native trigger receives its own open marker. Defaults to one area. */
  readonly triggers?: readonly Trigger[];
  readonly renderTrigger?: (
    id: string,
    attributes: readonly ChildAttribute[],
    isOpen: boolean,
  ) => Html;
  /** Text fields always retain their native menu, independently of this filter. */
  readonly filter?: (target: Element, triggerId: string) => boolean;
  readonly sideOffset?: number;
  readonly menuWidth?: number;
}
export const isOpen = (model: Model): boolean => !!model.menu.menus['']?.isOpen;
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const opened = isOpen(model);
  const triggers = props.triggers ?? [{ id: `${model.id}-trigger` }];
  return h.div(
    [
      h.Id(model.id),
      h.Class('ff-context-menu'),
      h.DataAttribute('context-menu-root', ''),
      h.DataAttribute('context-revision', String(model.revision)),
      h.DataAttribute('context-disabled', String(!!props.disabled)),
      { _tag: 'Prop', key: 'ffContextFilter', value: props.filter },
      h.OnMount(Mounted({ lifetime: model.menu.lifetime })),
      h.OnUnmount(Message.Unmounted({ lifetime: model.menu.lifetime })),
    ],
    [
      ...triggers.map((trigger) => {
        const active = opened && model.triggerId === trigger.id;
        const attributes = childAttributes([
          h.Key(trigger.id),
          h.Id(trigger.id),
          h.DataAttribute('context-menu-trigger', trigger.id),
          h.DataAttribute('context-disabled', String(!!trigger.disabled)),
          ...(active ? [h.DataAttribute('open', '')] : []),
        ]);
        return props.renderTrigger
          ? props.renderTrigger(trigger.id, attributes, active)
          : h.div([...attributes], [props.label]);
      }),
      model.point
        ? h.submodel({
            slotId: 'menu',
            model: model.menu,
            view: Tree.view,
            toParentMessage: (message) => Message.Menu({ message }),
            viewInputs: {
              ...props,
              placement: 'bottom-start',
              anchorGap: props.sideOffset ?? 2,
              rootClassName: props.rootClassName ?? 'contents',
              popupAttributesForPath: (path) => [
                ...(props.popupAttributesForPath?.(path) ?? []),
                ...(!path.length && props.menuWidth !== undefined
                  ? childAttributes([h.Style({ width: `${props.menuWidth}px` })])
                  : []),
              ],
              trigger: {
                attributes: childAttributes([
                  h.AriaHidden(true),
                  h.Tabindex(-1),
                  h.Class('ff-context-menu-anchor'),
                  h.DataAttribute('context-menu-anchor', ''),
                  h.Style({ left: `${model.point.x}px`, top: `${model.point.y}px` }),
                  h.OnMount(AnchorPortal()),
                ]),
                children: [],
              },
            },
          })
        : null,
    ],
  );
});
