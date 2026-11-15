import { Menu } from '@foldkit/ui';
import { Option, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as Dropdown from './state';

export const Model = Schema.Struct({ menu: Dropdown.Model, query: Schema.String });
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Behavior: { message: Dropdown.Message, lifetime: Schema.optionalKey(Schema.Number) },
  QueryChanged: { value: Schema.String, lifetime: Schema.optionalKey(Schema.Number) },
  SearchFocused: { lifetime: Schema.optionalKey(Schema.Number) },
  SearchOpened: { clearQuery: Schema.Boolean, lifetime: Schema.optionalKey(Schema.Number) },
  SearchUnmounted: { clearQuery: Schema.Boolean, lifetime: Schema.optionalKey(Schema.Number) },
  NavigatedToRow: { index: Schema.Number, lifetime: Schema.optionalKey(Schema.Number) },
  CreatedRequested: { value: Schema.String, lifetime: Schema.optionalKey(Schema.Number) },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Selected: { value: Schema.String, index: Schema.Number },
  Created: { value: Schema.String },
});
export type OutMessage = typeof OutMessage.Type;
export const init = (config: { readonly id: string }): Model => ({
  menu: Dropdown.init(config),
  query: '',
});
export function update(
  model: Model,
  message: Message,
  options: {
    readonly selection?: 'none' | 'single' | 'multiple';
    readonly clearOnClose?: boolean;
  } = {},
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  if (message.lifetime !== undefined && message.lifetime !== model.menu.lifetime) return { model };
  if (message._tag === 'Behavior' && !Dropdown.accepts(model.menu, message.message))
    return { model };
  if (message._tag === 'SearchOpened' || message._tag === 'SearchUnmounted')
    return { model: message.clearQuery && model.query ? { ...model, query: '' } : model };
  if (message._tag === 'CreatedRequested') {
    if (!model.menu.isOpen || !message.value || message.value !== model.query.trim())
      return { model };
    return {
      model: {
        menu: { ...model.menu, maybeActiveItemIndex: Option.none(), searchQuery: '' },
        query: '',
      },
      outMessage: OutMessage.Created({ value: message.value }),
    };
  }
  if (message._tag === 'QueryChanged' || message._tag === 'SearchFocused') {
    return {
      model: {
        ...model,
        query: message._tag === 'QueryChanged' ? message.value : model.query,
        menu: {
          ...model.menu,
          maybeActiveItemIndex: Option.none(),
          searchQuery: '',
          activationTrigger: 'Pointer',
        },
      },
    };
  }
  if (message._tag === 'Behavior' && message.message._tag === 'Unmounted') {
    const result = Dropdown.update(model.menu, message.message);
    return {
      model:
        result.model === model.menu
          ? model
          : {
              ...model,
              menu: result.model,
              query: options.clearOnClose === false ? model.query : '',
            },
    };
  }
  const result = Dropdown.update(
    model.menu,
    message._tag === 'NavigatedToRow'
      ? Menu.Message.ActivatedItem({ index: message.index, activationTrigger: 'Keyboard' })
      : message.message,
    { selection: options.selection },
  );
  const clear =
    options.clearOnClose !== false &&
    ((!model.menu.isOpen && result.model.isOpen) ||
      (!result.model.isOpen &&
        result.model.animation.transitionState === 'Idle' &&
        (model.menu.isOpen || model.menu.animation.transitionState !== 'Idle')));
  return {
    model: { menu: result.model, query: clear ? '' : model.query },
    outMessage: result.outMessage,
    commands: [
      ...(result.commands ?? []),
      ...(message._tag === 'NavigatedToRow'
        ? [
            Command.mapMessage(Menu.FocusItems({ id: model.menu.id }), (message) =>
              Dropdown.Message.Scoped({ message, lifetime: model.menu.lifetime }),
            ),
          ]
        : []),
    ].map((command) => Command.mapMessage(command, (message) => Message.Behavior({ message }))),
  };
}
export const matches = <Item extends { readonly label: string }>(
  items: readonly Item[],
  query: string,
): readonly Item[] =>
  items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

export { createCandidate } from '../options';
