import { Command, type Update } from 'foldkit';
import { FileDrop } from '@foldkit/ui';
import * as Tooltip from '../tooltip';
import {
  ClickFileInput,
  FocusField,
  Message,
  OutMessage,
  type Model,
  type QueuedMessage,
} from './state';

export const defaultAccept = 'image/png,image/jpeg,application/pdf';
/** What the consumer owns, as upstream's controlled props. */
export interface Options {
  readonly value: string;
  /** Present enables attachments (picker, drop, preview row). */
  readonly files?: readonly File[];
  readonly accept?: string;
  readonly maxFiles?: number;
  /** Present with `queue` enables the queue: a submit while streaming enqueues. */
  readonly status?: 'idle' | 'streaming';
  readonly queue?: readonly QueuedMessage[];
  readonly history?: readonly string[];
  readonly suggestions?: readonly string[];
  readonly placeholderSuggestion?: string;
  readonly disabled?: boolean;
}
type Result = Update.ReturnWithOutMessage<Model, Message, OutMessage>;
export const fieldId = (model: Model) => `${model.id}-field`;
export const fileInputId = (model: Model) => `${model.id}-files`;
export const suggestionsOpen = (options: Options) =>
  (options.suggestions?.length ?? 0) > 0 && options.value === '';
export const supportsQueue = (options: Options) =>
  options.status !== undefined && options.queue !== undefined;
export const canSend = (options: Options) =>
  !options.disabled && (options.value.trim().length > 0 || (options.files?.length ?? 0) > 0);
export type ButtonMode = 'send' | 'queue' | 'stop';
export const buttonMode = (options: Options, hasStop: boolean): ButtonMode =>
  options.status !== 'streaming'
    ? 'send'
    : canSend(options) && supportsQueue(options)
      ? 'queue'
      : hasStop
        ? 'stop'
        : 'send';
/** The history entry ArrowUp would recall from, or 0 when there is none. */
export const historyStart = (model: Model, options: Options) =>
  model.historyIndex ?? options.history?.length ?? 0;

const focus = (model: Model) => [FocusField({ id: fieldId(model) })];
const matches = (accept: string) => {
  const tokens = accept
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
  return (file: File) =>
    tokens.some((token) =>
      token.endsWith('/*')
        ? file.type.startsWith(token.slice(0, -1))
        : token.startsWith('.')
          ? file.name.toLowerCase().endsWith(token.toLowerCase())
          : file.type === token,
    );
};
const fingerprint = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;
/** Accepted, de-duplicated (name, size and date), capped at maxFiles. */
export function addFiles(options: Options, incoming: readonly File[]): readonly File[] | undefined {
  if (!options.files) return undefined;
  const accepts = matches(options.accept ?? defaultAccept);
  const seen = new Set(options.files.map(fingerprint));
  const accepted = incoming.filter((file) => {
    if (!accepts(file) || seen.has(fingerprint(file))) return false;
    seen.add(fingerprint(file));
    return true;
  });
  if (accepted.length === 0) return undefined;
  const next = [...options.files, ...accepted];
  return options.maxFiles === undefined ? next : next.slice(0, options.maxFiles);
}

/** Release the head of the queue on the consumer's streaming → idle edge,
 * as upstream auto-dispatches it: send it and drop it from the queue. */
export function release(
  model: Model,
  queue: readonly QueuedMessage[],
): {
  readonly model: Model;
  readonly queue: readonly QueuedMessage[];
  readonly sent?: QueuedMessage;
} {
  const [next, ...rest] = queue;
  if (!next) return { model, queue };
  return {
    model: {
      ...model,
      live: `Message sent.${rest.length ? ` ${rest.length} still queued.` : ''}`,
    },
    queue: rest,
    sent: next,
  };
}

export function update(model: Model, message: Message, options: Options): Result {
  const fill = (text: string): Result => ({
    model: { ...model, activeSuggestion: null, historyIndex: null },
    commands: focus(model),
    outMessage: OutMessage.ValueChanged({ value: text }),
  });
  const send = (): Result => {
    if (!canSend(options)) return { model };
    const text = options.value.trim(),
      files = options.files ?? [];
    const reset = { ...model, historyIndex: null };
    // While streaming, a submit enqueues the draft and clears the composer.
    if (options.status === 'streaming' && supportsQueue(options)) {
      const item = { id: `${model.id}-q${model.nextQueueId}`, text, files: [...files] };
      return {
        model: { ...reset, nextQueueId: model.nextQueueId + 1 },
        commands: focus(model),
        outMessage: OutMessage.QueueChanged({ queue: [...(options.queue ?? []), item] }),
      };
    }
    return {
      model: reset,
      outMessage: OutMessage.Sent({ value: text, files: [...files], queuedId: null }),
    };
  };
  const suggestions = options.suggestions ?? [];
  switch (message._tag) {
    case 'Typed':
      return {
        model: { ...model, historyIndex: null, activeSuggestion: null },
        outMessage: OutMessage.ValueChanged({ value: message.value }),
      };
    case 'KeyPressed': {
      const active = model.activeSuggestion;
      if (suggestionsOpen(options)) {
        if (message.key === 'ArrowDown')
          return {
            model: {
              ...model,
              activeSuggestion: active === null ? 0 : Math.min(active + 1, suggestions.length - 1),
              suggestionSource: 'keyboard',
            },
          };
        if (active !== null && message.key === 'ArrowUp')
          return {
            model: {
              ...model,
              activeSuggestion: active === 0 ? null : active - 1,
              suggestionSource: 'keyboard',
            },
          };
        if (active !== null && message.key === 'Enter') return fill(suggestions[active] ?? '');
        if (active !== null && message.key === 'Escape')
          return { model: { ...model, activeSuggestion: null } };
      }
      if (message.key === 'Tab' && options.placeholderSuggestion && options.value === '')
        return fill(options.placeholderSuggestion);
      if (message.key === 'Enter') return send();
      return { model };
    }
    case 'HistoryStepped': {
      const history = options.history ?? [];
      if (message.step === -1) {
        const start = historyStart(model, options);
        if (start <= 0) return { model };
        const index = start - 1;
        return {
          model: {
            ...model,
            historyIndex: index,
            draftBeforeHistory:
              model.historyIndex === null ? options.value : model.draftBeforeHistory,
          },
          commands: focus(model),
          outMessage: OutMessage.ValueChanged({ value: history[index] ?? '' }),
        };
      }
      if (model.historyIndex === null) return { model };
      const index = model.historyIndex + 1;
      const past = index >= history.length;
      return {
        model: { ...model, historyIndex: past ? null : index },
        commands: focus(model),
        outMessage: OutMessage.ValueChanged({
          value: past ? model.draftBeforeHistory : (history[index] ?? ''),
        }),
      };
    }
    case 'SendPressed':
      return send();
    case 'StopPressed':
      return { model, outMessage: OutMessage.Stopped() };
    case 'SuggestionHovered':
      // -1: the pointer left the list, which clears the highlight, as upstream.
      if (message.index < 0)
        return model.activeSuggestion === null || model.suggestionSource === 'keyboard'
          ? { model }
          : { model: { ...model, activeSuggestion: null } };
      return model.activeSuggestion === message.index && model.suggestionSource === 'pointer'
        ? { model }
        : { model: { ...model, activeSuggestion: message.index, suggestionSource: 'pointer' } };
    case 'SuggestionPicked':
      return fill(suggestions[message.index] ?? '');
    case 'Blurred':
      return model.activeSuggestion === null
        ? { model }
        : { model: { ...model, activeSuggestion: null } };
    case 'FilesPicked': {
      const files = addFiles(options, message.files);
      return files
        ? { model, outMessage: OutMessage.FilesChanged({ files: [...files] }) }
        : { model };
    }
    case 'FileRemoved':
      return options.files
        ? {
            model,
            outMessage: OutMessage.FilesChanged({
              files: options.files.filter((_, index) => index !== message.index),
            }),
          }
        : { model };
    case 'QueueEdited': {
      const queue = options.queue ?? [];
      const item = queue.find((entry) => entry.id === message.id);
      if (!item || !supportsQueue(options)) return { model };
      // Silent replace: the item leaves the queue and overwrites the draft.
      const files = options.files
        ? options.maxFiles === undefined
          ? item.files
          : item.files.slice(0, options.maxFiles)
        : [];
      return {
        model: { ...model, historyIndex: null },
        commands: focus(model),
        outMessage: OutMessage.Edited({
          value: item.text,
          files: [...files],
          queue: queue.filter((entry) => entry.id !== item.id),
        }),
      };
    }
    case 'QueueRemoved':
      return {
        model,
        outMessage: OutMessage.QueueChanged({
          queue: (options.queue ?? []).filter((entry) => entry.id !== message.id),
        }),
      };
    case 'QueueMoved': {
      const queue = [...(options.queue ?? [])];
      const from = queue.findIndex((entry) => entry.id === message.id),
        to = from + message.step;
      if (from < 0 || to < 0 || to >= queue.length) return { model };
      [queue[from], queue[to]] = [queue[to]!, queue[from]!];
      return { model, outMessage: OutMessage.QueueChanged({ queue }) };
    }
    case 'Drop': {
      const result = FileDrop.update(model.drop, message.message);
      const out = result.outMessage;
      const files =
        out?._tag === 'ReceivedFiles' && !options.disabled
          ? addFiles(options, out.files)
          : undefined;
      return {
        model: { ...model, drop: result.model },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (inner) => Message.Drop({ message: inner })),
        ),
        ...(files ? { outMessage: OutMessage.FilesChanged({ files: [...files] }) } : {}),
      };
    }
    case 'Tip': {
      const result = Tooltip.update(
        model.tooltips[message.key] ?? Tooltip.init({ id: `${model.id}-tip-${message.key}` }),
        message.message,
      );
      return {
        model: { ...model, tooltips: { ...model.tooltips, [message.key]: result.model } },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (inner) => Message.Tip({ key: message.key, message: inner })),
        ),
      };
    }
    case 'OpenFilePicker':
      return {
        model,
        commands: [ClickFileInput({ id: fileInputId(model), accept: message.accept })],
      };
    case 'Completed':
      return { model };
  }
}
