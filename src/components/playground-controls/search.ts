import { defineSilentMountWithArgs } from '../silent-mount';
import { Effect, Option, Queue, Schema, Stream } from 'effect';
import { Command, Dom, Mount, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as Input from '../input';
import * as KeyCap from '../key-cap';
import { icon } from '../icons';

export const Model = Schema.Struct({
  query: Schema.String,
  total: Schema.Number,
  shown: Schema.Number,
});
export type Model = typeof Model.Type;
export const init = (): Model => ({ query: '', total: 0, shown: 0 });
export const Message = defineMessageUnion({
  Changed: { query: Schema.String },
  Cleared: { id: Schema.String },
  Focused: {},
  CountsObserved: { query: Schema.String, total: Schema.Number, shown: Schema.Number },
});
export type Message = typeof Message.Type;
export const Focus = Command.define('Playground.Search.Focus', {
  args: { id: Schema.String },
  messages: [Message.Focused],
  execute: ({ id }) =>
    Dom.focus(`#${CSS.escape(id)}`).pipe(
      Effect.catch(() => Effect.void),
      Effect.as(Message.Focused()),
    ),
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Changed':
      return { model: { ...model, query: message.query } };
    case 'Cleared':
      return { model: { ...model, query: '' }, commands: [Focus({ id: message.id })] };
    case 'Focused':
      return { model };
    case 'CountsObserved':
      return message.query !== model.query ||
        (message.total === model.total && message.shown === model.shown)
        ? { model }
        : { model: { ...model, total: message.total, shown: message.shown } };
  }
}

/** Source PlaygroundPanel filters freely composed rows by their section,
 * label and selected value. The query is Model state; this scoped Mount
 * applies it to the caller's opaque, dynamically changing control views. */
function apply(rows: HTMLElement, query: string) {
  const q = query.trim().toLowerCase();
  let section = '',
    title: HTMLElement | null = null,
    used = false;
  let divider: HTMLElement | null = null,
    before = false,
    total = 0,
    shown = 0;
  const extras: { element: HTMLElement; divider: HTMLElement | null }[] = [];
  const close = () => {
    if (title) title.hidden = !used;
  };
  for (const element of [...rows.children] as HTMLElement[]) {
    if (element.tagName === 'HR') {
      close();
      title = null;
      section = '';
      element.hidden = true;
      divider = element;
      continue;
    }
    if (element.tagName === 'H3') {
      close();
      title = element;
      used = false;
      section = element.textContent?.toLowerCase() ?? '';
      continue;
    }
    const controls = element.matches('.ff-playground-switch')
      ? [element]
      : [...element.querySelectorAll<HTMLElement>('.ff-select-trigger,.ff-playground-switch')];
    if (!controls.length) {
      extras.push({ element, divider });
      divider = null;
      continue;
    }
    total++;
    const text = [
      element.querySelector(':scope > span')?.textContent,
      ...controls.map((control) =>
        control.matches('.ff-playground-switch')
          ? control.querySelector('.ff-switch-label')?.textContent
          : control.textContent,
      ),
    ]
      .join(' ')
      .toLowerCase();
    const match = !q || section.includes(q) || text.includes(q);
    element.hidden = !match;
    if (!match) continue;
    shown++;
    used = true;
    if (divider && before) divider.hidden = false;
    divider = null;
    before = true;
  }
  close();
  for (const extra of extras) {
    extra.element.hidden = shown === 0;
    if (extra.divider) extra.divider.hidden = shown === 0;
  }
  return { total, shown };
}

export const Filter = Mount.defineStream('Playground.Search.Filter', {
  args: {},
  messages: [Message.CountsObserved],
  execute: ({ element }) =>
    Stream.callback<typeof Message.CountsObserved.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const rows = element.querySelector<HTMLElement>('.ff-playground-rows');
          const input = element.querySelector<HTMLInputElement>('[data-play-search]');
          if (!rows) return () => {};
          let last = '';
          const sync = () => {
            const query = element.dataset.searchQuery ?? '';
            const counts = apply(rows, query);
            const signature = `${query}:${counts.total}:${counts.shown}`;
            if (last !== signature) {
              last = signature;
              Queue.offerUnsafe(queue, Message.CountsObserved({ query, ...counts }));
            }
          };
          sync();
          const observer = new MutationObserver(sync);
          observer.observe(rows, { childList: true, subtree: true, characterData: true });
          observer.observe(element, { attributes: true, attributeFilter: ['data-search-query'] });
          const key = (event: KeyboardEvent) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            if (
              event.key !== '/' ||
              event.defaultPrevented ||
              event.metaKey ||
              event.ctrlKey ||
              event.altKey ||
              target?.matches('input,textarea,[contenteditable=true]') ||
              target?.closest(
                '[role=listbox],[role=menu],[role=dialog],[role=combobox],[role=option]',
              ) ||
              element.inert ||
              element.dataset.searchable !== 'true' ||
              !input?.offsetParent
            )
              return;
            event.preventDefault();
            input.focus();
            input.select();
          };
          document.addEventListener('keydown', key);
          return () => {
            observer.disconnect();
            document.removeEventListener('keydown', key);
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
export const FocusMenu = defineSilentMountWithArgs('Playground.Search.MenuFocus', {
  args: { id: Schema.String },
  execute: ({ id }) =>
    Effect.sync(() => document.getElementById(id)?.focus({ preventScroll: true })).pipe(
      Effect.andThen(Effect.never),
    ),
});

export interface Props<P> {
  readonly model: Model;
  readonly toMessage: (message: Message) => P;
}
export function view<P>(props: Props<P>, id: string, icons: string, h: HtmlBuilder<P>) {
  const send = props.toMessage;
  return h.div(
    [h.Class('ff-playground-search'), h.Hidden(props.model.total < 8)],
    [
      icon('search', icons, h, { className: 'size-4 shrink-0 [stroke-width:1.5]' }),
      Input.view(
        {
          id,
          value: props.model.query,
          onInput: (query) => send(Message.Changed({ query })),
          placeholder: 'Search',
          ariaLabel: "Search the playground's options",
          autoComplete: 'off',
          attributes: [
            h.DataAttribute('play-search', ''),
            h.Attribute('aria-keyshortcuts', '/'),
            h.Attribute('inputmode', 'search'),
            h.Attribute('enterkeyhint', 'search'),
            h.Attribute('spellcheck', 'false'),
            h.OnKeyDownPreventDefault((key) =>
              key === 'Escape' && props.model.query
                ? Option.some(send(Message.Cleared({ id })))
                : Option.none(),
            ),
          ],
        },
        h,
      ),
      props.model.query
        ? h.button(
            [
              h.Type('button'),
              h.Class('ff-playground-search-clear'),
              h.AriaLabel('Clear the search'),
              h.OnClick(send(Message.Cleared({ id }))),
            ],
            [icon('x', icons, h, { className: 'size-4 [stroke-width:1.5]' })],
          )
        : KeyCap.view(
            {
              children: ['/'],
              className: 'mr-2 shrink-0 pointer-coarse:hidden',
              attributes: [h.AriaHidden(true)],
            },
            h,
          ),
    ],
  );
}
