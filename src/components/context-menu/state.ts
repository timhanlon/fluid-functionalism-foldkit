import { Effect, Option, Schema } from 'effect';
import { Menu } from '@foldkit/ui';
import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import * as Tree from '../dropdown/tree-state';
import * as Dropdown from '../dropdown/state';
import type { Selection } from '../dropdown/panel';
export const Model = Schema.Struct({
  id: Schema.String,
  menu: Tree.Model,
  point: Schema.NullOr(Schema.Struct({ x: Schema.Number, y: Schema.Number })),
  triggerId: Schema.NullOr(Schema.String),
  targetValue: Schema.NullOr(Schema.String),
  returnFocusId: Schema.String,
  revision: Schema.Number,
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Requested: {
    x: Schema.Number,
    y: Schema.Number,
    triggerId: Schema.String,
    targetValue: Schema.optionalKey(Schema.String),
    returnFocusId: Schema.optionalKey(Schema.String),
    lifetime: Schema.optionalKey(Schema.Number),
  },
  Menu: { message: Tree.Message },
  FocusRestored: { revision: Schema.Number },
  Unmounted: { lifetime: Schema.Number },
});
export type Message = typeof Message.Type;
export const OutMessage = defineMessageUnion({
  OpenChanged: {
    open: Schema.Boolean,
    triggerId: Schema.NullOr(Schema.String),
    targetValue: Schema.NullOr(Schema.String),
  },
  Selected: {
    value: Schema.String,
    path: Schema.Array(Schema.String),
    triggerId: Schema.NullOr(Schema.String),
    targetValue: Schema.NullOr(Schema.String),
  },
  Created: {
    value: Schema.String,
    path: Schema.Array(Schema.String),
    triggerId: Schema.NullOr(Schema.String),
    targetValue: Schema.NullOr(Schema.String),
  },
});
export type OutMessage = typeof OutMessage.Type;
export interface UpdateOptions {
  readonly items: readonly Tree.Item[];
  readonly disabled?: boolean;
  readonly search?: boolean;
  readonly clearOnClose?: boolean;
  readonly selection?: Selection;
  readonly selectionForPath?: (path: readonly number[]) => Selection | undefined;
}
export type Result = Update.Return<Model, Message> & {
  readonly outMessages?: readonly OutMessage[];
};
export const init = ({ id }: { readonly id: string }): Model => ({
  id,
  menu: Tree.init({ id: `${id}-menu` }),
  point: null,
  triggerId: null,
  targetValue: null,
  returnFocusId: '',
  revision: 0,
});
/** Stored on the mounted owner, never in the serializable application Model. */
export interface FocusOwner extends HTMLElement {
  ffContextReturnTo?: HTMLElement;
}
export const RestoreFocus = Command.define('ContextMenu.RestoreFocus', {
  args: {
    rootId: Schema.String,
    anchorId: Schema.String,
    targetId: Schema.String,
    revision: Schema.Number,
  },
  messages: [Message.FocusRestored],
  execute: ({ rootId, anchorId, targetId, revision }) =>
    Effect.callback<typeof Message.FocusRestored.Type>((resume) => {
      const frame = requestAnimationFrame(() => {
        const owner = document.getElementById(rootId) as FocusOwner | null;
        if (owner?.dataset.contextRevision === String(revision)) {
          const back = targetId ? document.getElementById(targetId) : owner.ffContextReturnTo;
          owner.ffContextReturnTo = undefined;
          const active = document.activeElement;
          if (back?.isConnected && (!active || active === document.body || active.id === anchorId))
            back.focus({ preventScroll: true });
        }
        resume(Effect.succeed(Message.FocusRestored({ revision })));
      });
      return Effect.sync(() => cancelAnimationFrame(frame));
    }),
});
const rootOpen = (menu: Tree.Model) => !!menu.menus['']?.isOpen;
const restored = (model: Model) =>
  RestoreFocus({
    rootId: model.id,
    anchorId: Menu.buttonId(model.menu.menus['']!.id),
    targetId: model.returnFocusId,
    revision: model.revision,
  });
export function update(model: Model, message: Message, options: UpdateOptions): Result {
  const treeOptions: Tree.UpdateOptions = {
    search: options.search,
    clearOnClose: options.clearOnClose,
    selectionForPath: (path) =>
      options.selectionForPath?.(path)?.mode ?? options.selection?.mode ?? 'none',
  };
  if (message._tag === 'FocusRestored') return { model };
  if (message._tag === 'Unmounted') {
    if (message.lifetime !== model.menu.lifetime) return { model };
    return {
      model: {
        ...model,
        menu: Tree.reset(model.menu),
        point: null,
        triggerId: null,
        targetValue: null,
        returnFocusId: '',
        revision: model.revision + 1,
      },
    };
  }
  if (message._tag === 'Requested') {
    if (
      options.disabled ||
      (message.lifetime !== undefined && message.lifetime !== model.menu.lifetime)
    )
      return { model };
    const first = options.items.findIndex((item) => !item.disabled);
    const result = Tree.update(
      model.menu,
      Tree.Message.Behavior({
        path: [],
        message: Dropdown.Message.Opened({
          maybeActiveItemIndex: first < 0 ? Option.none() : Option.some(first),
        }),
      }),
      options.items,
      treeOptions,
    );
    const next = {
      ...model,
      menu: result.model,
      point: { x: message.x, y: message.y },
      triggerId: message.triggerId,
      targetValue: message.targetValue ?? null,
      returnFocusId: message.returnFocusId ?? '',
      revision: model.revision + 1,
    };
    return {
      model: next,
      commands: result.commands?.map((command) =>
        Command.mapMessage(command, (message) => Message.Menu({ message })),
      ),
      outMessages: [
        OutMessage.OpenChanged({
          open: true,
          triggerId: next.triggerId,
          targetValue: next.targetValue,
        }),
      ],
    };
  }
  const input = message.message;
  if ('lifetime' in input && input.lifetime !== undefined && input.lifetime !== model.menu.lifetime)
    return { model };
  const child =
    input._tag === 'Behavior'
      ? input
      : input._tag === 'Search' && input.message._tag === 'Behavior'
        ? { path: [] as readonly number[], message: input.message.message }
        : undefined;
  if (child) {
    const branch = model.menu.menus[Tree.pathKey(child.path)];
    if (!branch || !Dropdown.accepts(branch, child.message)) return { model };
    if (
      input._tag === 'Search' &&
      input.message.lifetime !== undefined &&
      input.message.lifetime !== branch.lifetime
    )
      return { model };
  }
  const result = Tree.update(model.menu, input, options.items, treeOptions);
  const next = { ...model, menu: result.model };
  const commands: NonNullable<Result['commands']>[number][] =
    result.commands?.map((command) =>
      Command.mapMessage(command, (message) => Message.Menu({ message })),
    ) ?? [];
  const outMessages: OutMessage[] = [];
  if (result.outMessage)
    outMessages.push(
      OutMessage[result.outMessage._tag]({
        value: result.outMessage.value,
        path: result.outMessage.path,
        triggerId: model.triggerId,
        targetValue: model.targetValue,
      }),
    );
  const closed = rootOpen(model.menu) && !rootOpen(next.menu);
  if (closed) {
    outMessages.push(
      OutMessage.OpenChanged({
        open: false,
        triggerId: model.triggerId,
        targetValue: model.targetValue,
      }),
    );
    if (!commands.some((command) => command.name === Menu.FocusButton.name))
      commands.push(restored(next));
  }
  const leaf = child && Dropdown.primitiveMessage(child.message);
  if (child && !child.path.length && leaf?._tag === 'CompletedFocusButton' && !rootOpen(next.menu))
    commands.push(restored(next));
  return { model: next, commands, outMessages };
}
