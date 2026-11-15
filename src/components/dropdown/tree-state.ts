import { Menu } from '@foldkit/ui';
import { Option, Schema } from 'effect';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as State from './state';
import type * as Dropdown from './index';
import * as Searchable from './search-state';

export interface Item extends Dropdown.Item {
  readonly children?: readonly Item[];
}
export const Model = Schema.Struct({
  id: Schema.String,
  menus: Schema.Record(Schema.String, State.Model),
  lifetime: Schema.Number,
  nextMenuLifetime: Schema.Number,
  openPath: Schema.Array(Schema.Number),
  query: Schema.String,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Behavior: {
    path: Schema.Array(Schema.Number),
    message: State.Message,
    lifetime: Schema.optionalKey(Schema.Number),
  },
  OpenedSubmenu: {
    path: Schema.Array(Schema.Number),
    index: Schema.Number,
    keyboard: Schema.Boolean,
    lifetime: Schema.optionalKey(Schema.Number),
  },
  ClosedSubmenu: { path: Schema.Array(Schema.Number), lifetime: Schema.optionalKey(Schema.Number) },
  Dismissed: {},
  DismissedAt: { lifetime: Schema.Number },
  Unmounted: { lifetime: Schema.Number, clearQuery: Schema.Boolean },
  Search: { message: Searchable.Message, lifetime: Schema.optionalKey(Schema.Number) },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  Selected: { value: Schema.String, path: Schema.Array(Schema.String) },
  Created: { value: Schema.String, path: Schema.Array(Schema.String) },
});
export type OutMessage = typeof OutMessage.Type;
type Result = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
export const pathKey = (path: readonly number[]) => path.join('.');
export const menuId = (id: string, path: readonly number[]) =>
  path.length ? `${id}-sub-${path.join('-')}` : id;
export function itemsAt(items: readonly Item[], path: readonly number[]): readonly Item[] {
  let current = items;
  for (const index of path) current = current[index]?.children ?? [];
  return current;
}
export const init = ({ id }: { readonly id: string }): Model => ({
  id,
  menus: { '': State.init({ id }) },
  lifetime: 0,
  nextMenuLifetime: 1,
  openPath: [],
  query: '',
});

/** Replace an owned tree without reusing an earlier menu instance's scope. */
export const reset = (model: Model, clearQuery = true): Model => ({
  ...init({ id: model.id }),
  lifetime: model.lifetime + 1,
  nextMenuLifetime: model.nextMenuLifetime + 1,
  menus: { '': State.init({ id: model.id, lifetime: model.nextMenuLifetime }) },
  query: clearQuery ? '' : model.query,
});

export interface UpdateOptions {
  readonly selectionForPath?: (path: readonly number[]) => Dropdown.Panel.Selection['mode'];
  readonly search?: boolean;
  readonly clearOnClose?: boolean;
}
export function update(
  model: Model,
  message: Message,
  items: readonly Item[],
  options: UpdateOptions = {},
): Result {
  if (
    'lifetime' in message &&
    message.lifetime !== undefined &&
    message.lifetime !== model.lifetime
  )
    return { model };
  if (message._tag === 'Unmounted') return { model: reset(model, message.clearQuery) };
  let nextMenuLifetime = model.nextMenuLifetime;
  let menus = { ...model.menus },
    openPath = model.openPath,
    query = model.query;
  const visibleItems = options.search ? Searchable.matches(items, query) : items;
  const levelItems = (path: readonly number[]) =>
    path.length ? itemsAt(items, path) : visibleItems;
  const stableIndex = (path: readonly number[], index: number) =>
    path.length ? index : items.findIndex((item) => item.value === visibleItems[index]?.value);
  const commands: NonNullable<Result['commands']>[number][] = [];
  const apply = (path: readonly number[], message: State.Message) => {
    const key = pathKey(path),
      before =
        menus[key] ?? State.init({ id: menuId(model.id, path), lifetime: nextMenuLifetime++ });
    const result = State.update(before, message);
    if (
      !path.length &&
      options.search &&
      options.clearOnClose !== false &&
      ((!before.isOpen && result.model.isOpen) ||
        (!result.model.isOpen &&
          result.model.animation.transitionState === 'Idle' &&
          (before.isOpen || before.animation.transitionState !== 'Idle')))
    )
      query = '';
    nextMenuLifetime = Math.max(nextMenuLifetime, result.model.lifetime + 1);
    menus[key] = result.model;
    commands.push(
      ...(result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) =>
          Message.Behavior({ path, message, lifetime: model.lifetime }),
        ),
      ),
    );
    return result;
  };
  const closeBelow = (depth: number) => {
    for (const key of Object.keys(menus)) {
      const path = key ? key.split('.').map(Number) : [];
      if (path.length > depth && menus[key]?.isOpen) apply(path, Menu.Message.BlurredItems());
    }
    openPath = openPath.slice(0, depth);
  };
  const focus = (path: readonly number[]) => {
    const lifetime = menus[pathKey(path)]!.lifetime;
    commands.push(
      Command.mapMessage(Menu.FocusItems({ id: menus[pathKey(path)]!.id }), (message) =>
        Message.Behavior({
          path,
          message: State.Message.Scoped({ message, lifetime }),
          lifetime: model.lifetime,
        }),
      ),
    );
  };
  const open = (path: readonly number[], index: number, keyboard: boolean) => {
    const item = levelItems(path)[index];
    if (!item?.children?.length || item.disabled || !menus[pathKey(path)]?.isOpen) return;
    const child = [...path, stableIndex(path, index)];
    if (pathKey(openPath) !== pathKey(child)) closeBelow(path.length);
    apply(
      path,
      Menu.Message.ActivatedItem({ index, activationTrigger: keyboard ? 'Keyboard' : 'Pointer' }),
    );
    const children = levelItems(child);
    const first = children.findIndex((item) => !item.disabled);
    apply(
      child,
      Menu.Message.Opened({
        maybeActiveItemIndex: keyboard && first >= 0 ? Option.some(first) : Option.none(),
      }),
    );
    openPath = child;
  };
  let outMessage: OutMessage | undefined;
  if (message._tag === 'Search') {
    const event = message.message;
    if (event.lifetime !== undefined && event.lifetime !== menus['']?.lifetime) return { model };
    if (event._tag === 'Behavior')
      return update(
        model,
        Message.Behavior({ path: [], message: event.message, lifetime: model.lifetime }),
        items,
        options,
      );
    const result = Searchable.update({ menu: menus['']!, query }, event, {
      clearOnClose: options.clearOnClose,
    });
    if (
      result.model.menu === menus[''] &&
      result.model.query === query &&
      !result.outMessage &&
      !result.commands?.length
    )
      return { model };
    menus[''] = result.model.menu;
    query = result.model.query;
    closeBelow(0);
    commands.push(
      ...(result.commands ?? []).map((command) =>
        Command.mapMessage(command, (message) =>
          Message.Search({ message, lifetime: model.lifetime }),
        ),
      ),
    );
    if (result.outMessage?._tag === 'Created') {
      const value = result.outMessage.value;
      outMessage = OutMessage.Created({ value, path: [value] });
      if (options.selectionForPath?.([]) !== 'multiple') apply([], Menu.Message.Closed());
    }
  } else if (message._tag === 'OpenedSubmenu') open(message.path, message.index, message.keyboard);
  else if (message._tag === 'ClosedSubmenu') {
    if (!message.path.length || !message.path.every((index, depth) => openPath[depth] === index))
      return { model };
    closeBelow(message.path.length - 1);
    focus(message.path.slice(0, -1));
  } else if (message._tag === 'Dismissed' || message._tag === 'DismissedAt') {
    apply([], Menu.Message.BlurredItems());
    closeBelow(0);
  } else {
    const { path, message: incoming } = message;
    const current = menus[pathKey(path)];
    if ('lifetime' in incoming && incoming.lifetime !== current?.lifetime) return { model };
    if (current && !State.accepts(current, incoming)) return { model };
    if (incoming._tag === 'Unmounted') {
      if (!current || incoming.lifetime !== current.lifetime) return { model };
      apply(path, incoming);
      for (const [key, child] of Object.entries(menus)) {
        const childPath = key ? key.split('.').map(Number) : [];
        if (
          childPath.length > path.length &&
          path.every((part, index) => childPath[index] === part)
        )
          apply(childPath, State.Message.Unmounted({ lifetime: child.lifetime }));
      }
      openPath = openPath.slice(0, Math.max(0, path.length - 1));
      if (!path.length && options.search && options.clearOnClose !== false) query = '';
      return { model: { ...model, menus, openPath, query, nextMenuLifetime } };
    }
    const event = State.primitiveMessage(incoming) ?? incoming;
    // A removed submenu may still have queued animation/typeahead completions.
    // Its old messages must not recreate a menu for a branch no longer present.
    if (path.length && (!menus[pathKey(path)] || !itemsAt(items, path).length)) return { model };
    const currentItems = levelItems(path);
    if (
      ['SelectedItem', 'ActivatedItem', 'MovedPointerOverItem', 'DeactivatedItem'].includes(
        event._tag,
      ) &&
      !menus[pathKey(path)]?.isOpen
    )
      return { model };
    if (event._tag === 'SelectedItem') {
      const item = currentItems[event.index];
      if (!item || item.disabled || item.value !== event.item) return { model };
      if (item.children?.length) open(path, event.index, true);
      else {
        const values: string[] = [];
        let level = items;
        for (const index of path) {
          const parent = level[index];
          if (!parent) return { model };
          values.push(parent.value);
          level = parent.children ?? [];
        }
        outMessage = OutMessage.Selected({ value: item.value, path: [...values, item.value] });
        if (options.selectionForPath?.(path) !== 'multiple') {
          apply([], Menu.Message.Closed());
          closeBelow(0);
        }
      }
    } else if (event._tag === 'Closed' && path.length) {
      if (!path.every((index, depth) => openPath[depth] === index)) return { model };
      closeBelow(path.length - 1);
      focus(path.slice(0, -1));
    } else {
      apply(path, incoming);
      const activeBranch =
        path.length <= openPath.length && path.every((index, depth) => openPath[depth] === index);
      if (!menus[pathKey(path)]?.isOpen && activeBranch) closeBelow(Math.max(0, path.length - 1));
      else if (event._tag === 'DeactivatedItem' && openPath[path.length] !== undefined)
        closeBelow(path.length);
      else if (
        (event._tag === 'ActivatedItem' || event._tag === 'MovedPointerOverItem') &&
        openPath[path.length] !== undefined &&
        openPath[path.length] !== stableIndex(path, event.index)
      )
        closeBelow(path.length);
    }
  }
  return { model: { ...model, menus, openPath, query, nextMenuLifetime }, commands, outMessage };
}
