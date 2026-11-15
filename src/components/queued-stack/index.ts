import { shapeRadius } from '../shape';
import { Schema } from 'effect';
import { Command, Submodel, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { ChildAttribute, Html } from 'foldkit/html';
import * as Tooltip from '../tooltip';
import * as FileThumbnail from '../file-thumbnail';
import { icon } from '../icons';
import { QueuedMessage } from '../input-message/state';
import { Mounted } from './runtime';
import { Message } from './messages';
import './styles.css';

/** Upstream's QueuedStack block: a Sonner-style pile of queued messages over
 * the composer. Collapsed, the front card and two peeks show; hovering (or a
 * tap on touch) fans it out, and while fanned out a card drags to reorder.
 * A gutter arrow shows the count once cards overflow the peeks. Hover, drag
 * and tap state are visual and live in the runtime; the queue is the
 * consumer's, changed through OutMessages. */
export const cardHeight = (size: 'default' | 'compact' = 'default') =>
  size === 'compact' ? 38 : 44;
const peek = 12,
  maxPeek = 2;
/** The collapsed pile's height: consumers reserve transcript padding with it. */
export const collapsedHeight = (count: number, size: 'default' | 'compact' = 'default') =>
  cardHeight(size) + Math.min(Math.max(count - 1, 0), maxPeek) * peek;

export const Model = Schema.Struct({
  id: Schema.String,
  tooltips: Schema.Record(Schema.String, Tooltip.Model),
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const init = (config: { readonly id: string }): Model => ({ id: config.id, tooltips: {} });
export { Message } from './messages';
export const OutMessage = defineMessageUnion({
  QueueChanged: { queue: Schema.Array(QueuedMessage) },
  /** Pull the card back into the composer (✎ or double-click). */
  Edit: { item: QueuedMessage },
  Remove: { item: QueuedMessage },
});
export type OutMessage = typeof OutMessage.Type;

export function update(
  model: Model,
  message: Message,
  queue: readonly QueuedMessage[],
): Update.ReturnWithOutMessage<Model, Message, OutMessage> {
  switch (message._tag) {
    case 'Edited':
    case 'Removed': {
      const item = queue.find((entry) => entry.id === message.id);
      if (!item) return { model };
      return {
        model,
        outMessage:
          message._tag === 'Edited' ? OutMessage.Edit({ item }) : OutMessage.Remove({ item }),
      };
    }
    case 'Reordered': {
      const byId = new Map(queue.map((entry) => [entry.id, entry]));
      const next = message.ids.flatMap((id) => byId.get(id) ?? []);
      if (next.length !== queue.length) return { model };
      return { model, outMessage: OutMessage.QueueChanged({ queue: next }) };
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
  }
}

export interface Props {
  readonly queue: readonly QueuedMessage[];
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  /** Distance from the container's bottom edge. Omitted, the stack sits 8px
   * above the sibling InputMessage and follows its height. */
  readonly bottom?: number;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const size = props.size ?? 'default',
    compact = size === 'compact';
  const count = props.queue.length;
  if (count === 0) return h.div([h.Key('empty'), h.Class('ff-qs-empty')], []);
  const tip = (
    key: string,
    content: string,
    side: 'top' | 'left',
    trigger: (attributes: readonly ChildAttribute[]) => Html,
  ) =>
    h.submodel({
      slotId: `tip-${key}`,
      model: model.tooltips[key] ?? Tooltip.init({ id: `${model.id}-tip-${key}` }),
      view: Tooltip.view,
      toParentMessage: (message) => Message.Tip({ key, message }),
      viewInputs: {
        content,
        side,
        ...(props.radius ? { radius: props.radius } : {}),
        renderTrigger: trigger,
      },
    });
  const glyph = (name: Parameters<typeof icon>[0], px: number, stroke: number) =>
    h.span(
      [
        h.Class('ff-qs-glyph'),
        h.Style({ '--ff-qs-glyph': `${px}px`, '--ff-qs-stroke': String(stroke) }),
      ],
      [icon(name, props.icons, h)],
    );
  // Thumbnails inset 8px (7 compact) from the card follow its curve.
  const attachmentRadius = Math.max(0, shapeRadius(props.radius) - (compact ? 7 : 8));
  const hidden = Math.max(0, count - (maxPeek + 1));
  const action = (
    key: string,
    label: string,
    aria: string,
    name: 'pencil' | 'x',
    message: Message,
  ) =>
    tip(key, label, 'top', (attributes) =>
      h.button(
        [
          ...attributes,
          h.Type('button'),
          h.Class('ff-qs-action'),
          h.AriaLabel(aria),
          h.OnClick(message),
        ],
        [glyph(name, 14, name === 'x' ? 2.5 : 2)],
      ),
    );
  return h.div(
    [
      // A distinct key: the empty placeholder must not be patched into the
      // stack, or its Mount would never run.
      h.Key('stack'),
      h.Class('ff-queued-stack'),
      h.DataAttribute('size', size),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('count', String(count)),
      ...(props.bottom === undefined ? [] : [h.DataAttribute('bottom', String(props.bottom))]),
      h.OnMount(Mounted()),
    ],
    [
      h.div(
        [h.Class('ff-qs-inner')],
        [
          tip('count', `${count} queued message${count === 1 ? '' : 's'}`, 'left', (attributes) =>
            h.div(
              [...attributes, h.Class('ff-qs-gutter'), h.Tabindex(-1)],
              [
                hidden > 0 ? h.span([h.Class('ff-qs-count')], [String(count)]) : null,
                glyph('corner-down-right', 16, 2),
              ],
            ),
          ),
          tip('collapse', 'Collapse', 'left', (attributes) =>
            h.button(
              [
                ...attributes,
                h.Type('button'),
                h.Class('ff-qs-collapse'),
                h.AriaLabel('Collapse queued messages'),
                h.DataAttribute('qs-collapse', ''),
              ],
              [glyph('chevron-down', 18, 2)],
            ),
          ),
          ...props.queue.map((item, index) => {
            const label =
              item.text || `${item.files.length} attachment${item.files.length === 1 ? '' : 's'}`;
            return h.div(
              [
                h.Key(item.id),
                h.Class('ff-qs-card'),
                h.DataAttribute('qs-card', item.id),
                h.DataAttribute('index', String(index)),
                ...(item.files.length > 0 ? [h.DataAttribute('files', '')] : []),
                h.OnDoubleClick(Message.Edited({ id: item.id })),
              ],
              [
                item.files.length > 0
                  ? h.div(
                      [h.Class('ff-qs-files')],
                      [
                        ...item.files.slice(0, 3).map((file, position) =>
                          FileThumbnail.view(
                            {
                              file,
                              size: compact ? 24 : 28,
                              radius: attachmentRadius,
                              attributes: [h.Key(`${file.name}-${file.size}-${position}`)],
                            },
                            h,
                          ),
                        ),
                        item.files.length > 3
                          ? h.span(
                              [
                                h.Class('ff-qs-more'),
                                h.Style({ borderRadius: `${attachmentRadius}px` }),
                              ],
                              [`+${item.files.length - 3}`],
                            )
                          : null,
                      ],
                    )
                  : null,
                h.span([h.Class('ff-qs-label')], [label]),
                h.div(
                  [h.Class('ff-qs-actions')],
                  [
                    action(
                      `edit-${item.id}`,
                      'Edit',
                      `Edit queued message: ${item.text}`,
                      'pencil',
                      Message.Edited({ id: item.id }),
                    ),
                    action(
                      `remove-${item.id}`,
                      'Remove',
                      `Remove queued message: ${item.text}`,
                      'x',
                      Message.Removed({ id: item.id }),
                    ),
                  ],
                ),
              ],
            );
          }),
        ],
      ),
    ],
  );
});
