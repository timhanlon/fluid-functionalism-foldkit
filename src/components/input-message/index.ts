import { shapeClass, shapeRadius } from '../shape';
import { Option } from 'effect';
import { cn } from '../../lib/utils';
import { Submodel } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { FileDrop } from '@foldkit/ui';
import * as Button from '../button';
import * as Tooltip from '../tooltip';
import * as FileThumbnail from '../file-thumbnail';
import { icon } from '../icons';
import { Message, type Model, type QueuedMessage } from './state';
import {
  buttonMode,
  canSend,
  defaultAccept,
  fieldId,
  historyStart,
  suggestionsOpen,
  supportsQueue,
  type Options,
} from './update';
import { Mounted } from './runtime';
import '../../fluid-hover/styles.css';
import './styles.css';
export { Model, Message, OutMessage, QueuedMessage, init, FocusField } from './state';
export { update, release, addFiles, defaultAccept, fieldId, type Options } from './update';

/** A chat composer, as upstream's InputMessage: an auto-growing textarea, an
 * action bar with consumer slots and a send / queue / stop button, optional
 * attachments (picker and drop), a reorderable queue while a response
 * streams, readline-style history, and suggested prompts. The consumer owns
 * the draft, files, queue and status (see Options); slot controls dispatch
 * the consumer's own messages, and `Message.OpenFilePicker` opens the picker. */
export interface Props extends Options {
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly placeholder?: string;
  /** Bottom-left actions, e.g. an attach button. */
  readonly leftSlot?: () => readonly Html[];
  /** Bottom-right actions, before the send button. */
  readonly rightSlot?: () => readonly Html[];
  readonly minRows?: number;
  readonly maxRows?: number;
  /** Clicking the surrounding container focuses the textarea. Defaults to true. */
  readonly clickToFocus?: boolean;
  readonly sendLabel?: string;
  /** Side of each attachment tile in pixels. Defaults to 80. */
  readonly filePreviewSize?: number;
  /** The send button becomes Stop while streaming with an empty draft. */
  readonly stoppable?: boolean;
  /** Render the built-in queue rows above the textarea. Defaults to true. */
  readonly showQueue?: boolean;
  readonly ariaLabel?: string;
  readonly className?: string;
}

export const view = Submodel.defineView<Model, Message, Props>((model, props, h) =>
  h.submodel({
    slotId: 'drop',
    model: model.drop,
    view: FileDrop.view,
    toParentMessage: (message) => Message.Drop({ message }),
    viewInputs: {
      accept: (props.accept ?? defaultAccept)
        .split(',')
        .map((token) => token.trim())
        .filter(Boolean),
      multiple: props.maxFiles === undefined || props.maxFiles > 1,
      isDisabled: !!props.disabled || props.files === undefined,
      toView: ({ root, input }) => composer(model, props, h, root, input),
    },
  }),
);

function composer(
  model: Model,
  props: Props,
  h: HtmlBuilder<Message>,
  root: Parameters<Parameters<typeof FileDrop.view>[1]['toView']>[0]['root'],
  input: Parameters<Parameters<typeof FileDrop.view>[1]['toView']>[0]['input'],
): Html {
  const size = props.size ?? 'default',
    compact = size === 'compact';
  const files = props.files ?? [],
    queue = props.queue ?? [],
    suggestions = props.suggestions ?? [];
  const open = suggestionsOpen(props);
  const active = open ? model.activeSuggestion : null;
  const dragging = model.drop.isDragOver && props.files !== undefined;
  const ghost = !!props.placeholderSuggestion && props.value === '' && !dragging;
  const listId = `${model.id}-suggestions`,
    ghostId = `${model.id}-ghost`;
  const mode = buttonMode(props, !!props.stoppable);
  const clickToFocus = props.clickToFocus !== false && !props.disabled;
  const tip = (
    key: string,
    label: string,
    trigger: (attributes: readonly import('foldkit/html').ChildAttribute[]) => Html,
  ) =>
    h.submodel({
      slotId: `tip-${key}`,
      model: model.tooltips[key] ?? Tooltip.init({ id: `${model.id}-tip-${key}` }),
      view: Tooltip.view,
      toParentMessage: (message) => Message.Tip({ key, message }),
      viewInputs: {
        content: label,
        side: 'top',
        ...(props.radius ? { radius: props.radius } : {}),
        renderTrigger: trigger,
      },
    });
  const x = (sizePx: number) =>
    h.span(
      [h.Class('ff-im-x'), h.Style({ '--ff-im-x': `${sizePx}px` })],
      [icon('x', props.icons, h)],
    );
  const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;
  const tiles = files.map((file, index) =>
    h.div(
      [h.Key(fileKey(file)), h.Class('ff-im-tile'), h.DataAttribute('im-tile', fileKey(file))],
      [
        FileThumbnail.view(
          {
            file,
            size: props.filePreviewSize ?? 80,
            radius: Math.max(0, shapeRadius(props.radius, 12, 24) - 8),
          },
          h,
        ),
        tip(`file-${fileKey(file)}`, 'Remove', (attributes) =>
          h.button(
            [
              ...attributes,
              h.Type('button'),
              h.Class('ff-im-tile-remove'),
              h.AriaLabel(`Remove ${file.name}`),
              h.OnClick(Message.FileRemoved({ index })),
            ],
            [x(12)],
          ),
        ),
      ],
    ),
  );
  const queueLabel = (item: QueuedMessage) =>
    item.text || `${item.files.length} attachment${item.files.length === 1 ? '' : 's'}`;
  const rows = queue.map((item, index) =>
    h.div(
      [
        h.Key(item.id),
        h.Class('ff-im-queued'),
        h.DataAttribute('im-queued', item.id),
        h.Tabindex(0),
        h.AriaLabel(`Queued message ${index + 1} of ${queue.length}: ${queueLabel(item)}`),
        h.OnDoubleClick(Message.QueueEdited({ id: item.id })),
        h.OnKeyDownPreventDefault((key, modifiers) =>
          key === 'Enter' || key === 'F2'
            ? Option.some(Message.QueueEdited({ id: item.id }))
            : key === 'Delete' || key === 'Backspace'
              ? Option.some(Message.QueueRemoved({ id: item.id }))
              : modifiers.altKey && (key === 'ArrowUp' || key === 'ArrowDown')
                ? Option.some(Message.QueueMoved({ id: item.id, step: key === 'ArrowUp' ? -1 : 1 }))
                : Option.none(),
        ),
      ],
      [
        item.files.length > 0
          ? h.span(
              [h.Class('ff-im-queued-files')],
              [
                icon('image', props.icons, h),
                item.text ? h.span([], [String(item.files.length)]) : null,
              ],
            )
          : null,
        h.span([h.Class('ff-im-queued-label')], [queueLabel(item)]),
        tip(`queue-${item.id}`, 'Remove', (attributes) =>
          h.button(
            [
              ...attributes,
              h.Type('button'),
              h.Class('ff-im-queued-remove'),
              h.AriaLabel(`Remove queued message: ${queueLabel(item)}`),
              h.OnClick(Message.QueueRemoved({ id: item.id })),
            ],
            [x(13)],
          ),
        ),
      ],
    ),
  );
  const region = (name: string, isOpen: boolean, content: Html, extraClass = '') =>
    h.div(
      [
        h.Class(`ff-im-region ${extraClass}`),
        h.DataAttribute('im-region', name),
        ...(isOpen ? [h.DataAttribute('open', '')] : []),
      ],
      [content],
    );
  const keys = (
    key: string,
    modifiers: { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean },
  ): Option.Option<Message> => {
    const plain =
      !modifiers.shiftKey && !modifiers.altKey && !modifiers.metaKey && !modifiers.ctrlKey;
    if (
      open &&
      plain &&
      (key === 'ArrowDown' || (active !== null && ['ArrowUp', 'Enter', 'Escape'].includes(key)))
    )
      return Option.some(Message.KeyPressed({ key }));
    if (key === 'Tab' && !modifiers.shiftKey && ghost)
      return Option.some(Message.KeyPressed({ key }));
    if (key === 'Enter' && !modifiers.shiftKey) return Option.some(Message.KeyPressed({ key }));
    return Option.none();
  };
  const history = props.history ?? [];
  const field = h.div(
    [h.Class('ff-im-field-wrap')],
    [
      h.textarea([
        h.Id(fieldId(model)),
        h.Class('ff-im-field'),
        h.Value(props.value),
        h.Attribute('rows', String(props.minRows ?? 1)),
        h.AriaLabel(props.ariaLabel ?? 'Message'),
        ...(ghost ? [h.AriaDescribedBy(ghostId)] : []),
        ...(active !== null ? [h.Attribute('aria-activedescendant', `${listId}-${active}`)] : []),
        ...(dragging
          ? [h.Placeholder('Drop files here to add to chat')]
          : props.placeholderSuggestion
            ? []
            : [h.Placeholder(props.placeholder ?? 'Ask me anything…')]),
        h.Disabled(!!props.disabled),
        h.OnInput((value) => Message.Typed({ value })),
        h.OnKeyDownPreventDefault(keys),
        h.OnBlur(Message.Blurred()),
      ]),
      ghost
        ? h.div(
            [h.AriaHidden(true), h.Class('ff-im-ghost')],
            [
              h.span(
                [h.Class('ff-im-ghost-line')],
                [
                  h.span([h.Class('ff-im-ghost-text')], [props.placeholderSuggestion!]),
                  h.kbd([h.Class('ff-im-ghost-kbd')], ['Tab']),
                ],
              ),
            ],
          )
        : null,
      ghost
        ? h.span(
            [h.Id(ghostId), h.Class('sr-only')],
            [
              `Suggested prompt: ${props.placeholderSuggestion}. Press Tab to fill the composer with it.`,
            ],
          )
        : null,
    ],
  );
  const send = Button.view(
    {
      variant: 'primary',
      size: 'icon-compact',
      ...(props.radius ? { radius: props.radius } : {}),
      label:
        mode === 'stop' ? 'Stop' : mode === 'queue' ? 'Queue message' : (props.sendLabel ?? 'Send'),
      disabled: mode === 'stop' ? !!props.disabled : !canSend(props),
      className: 'ff-im-send',
      onClick: mode === 'stop' ? Message.StopPressed() : Message.SendPressed(),
      attributes: [h.DataAttribute('im-mode', mode === 'stop' ? 'stop' : 'arrow')],
      children: [
        mode === 'stop'
          ? h.span([h.Class('ff-im-send-glyph ff-im-stop')], [])
          : h.span([h.Class('ff-im-send-glyph')], [icon('arrow-up', props.icons, h)]),
      ],
    },
    h,
  );
  return h.div(
    [
      ...root,
      h.Class(
        cn(
          'ff-input-message bg-surface-2 shadow-surface-2',
          shapeClass(props.radius, 'rounded-xl', 'rounded-3xl'),
          props.className,
        ),
      ),
      h.DataAttribute('size', size),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      ...(clickToFocus ? [h.DataAttribute('click-to-focus', '')] : []),
      ...(props.disabled ? [h.DataAttribute('im-disabled', '')] : []),
      h.DataAttribute('min-rows', String(props.minRows ?? 1)),
      h.DataAttribute('max-rows', String(props.maxRows ?? 8)),
      // History recall needs the caret line, which only the runtime can see;
      // these flags say whether ↑ / ↓ would recall once the caret allows it.
      ...(history.length > 0 && historyStart(model, props) > 0 && !(open && active !== null)
        ? [h.DataAttribute('history-up', '')]
        : []),
      ...(history.length > 0 && model.historyIndex !== null && !open
        ? [h.DataAttribute('history-down', '')]
        : []),
      h.OnMount(Mounted()),
    ],
    [
      props.files !== undefined ? h.input([...input, h.AriaHidden(true), h.Tabindex(-1)]) : null,
      props.files !== undefined
        ? region('files', files.length > 0, h.div([h.Class('ff-im-files')], tiles))
        : null,
      supportsQueue(props) && props.showQueue !== false
        ? region(
            'queue',
            queue.length > 0,
            h.div([h.Class('ff-im-queue'), h.DataAttribute('im-queue', '')], rows),
          )
        : null,
      field,
      h.div(
        [h.Class('ff-im-footer')],
        [
          h.div([h.Class('ff-im-slot ff-im-slot-left')], props.leftSlot ? props.leftSlot() : []),
          h.div(
            [h.Class('ff-im-slot ff-im-slot-right')],
            [...(props.rightSlot ? props.rightSlot() : []), send],
          ),
        ],
      ),
      suggestions.length > 0
        ? region(
            'suggestions',
            open,
            h.div(
              [
                h.Role('listbox'),
                h.Id(listId),
                h.AriaLabel('Suggested prompts'),
                h.Class('ff-im-suggestions'),
              ],
              suggestions.map((text, index) =>
                h.div(
                  [
                    h.Key(`${text}-${index}`),
                    h.Id(`${listId}-${index}`),
                    h.Role('option'),
                    h.AriaSelected(index === active),
                    h.DataAttribute('fluid-hover-index', String(index)),
                    ...(index === active ? [h.DataAttribute('active', '')] : []),
                    h.Class('ff-im-suggestion'),
                    h.OnClick(Message.SuggestionPicked({ index })),
                  ],
                  [
                    h.span([h.Class('ff-im-suggestion-text')], [text]),
                    index === 0 && active === null
                      ? h.span(
                          [h.Class('ff-im-suggestion-hint')],
                          [icon('arrow-down', props.icons, h)],
                        )
                      : h.span(
                          [
                            h.Class('ff-im-suggestion-enter'),
                            ...(index === active ? [h.DataAttribute('shown', '')] : []),
                          ],
                          [icon('corner-down-left', props.icons, h)],
                        ),
                  ],
                ),
              ),
            ),
            'ff-im-suggestions-region',
          )
        : null,
      h.span(
        [h.Class('sr-only'), h.Role('status'), h.Attribute('aria-live', 'polite')],
        [model.live],
      ),
    ],
  );
}
