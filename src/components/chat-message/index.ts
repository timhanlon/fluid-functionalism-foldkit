import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import * as FileThumbnail from '../file-thumbnail';
import { Mounted } from './runtime';
import './styles.css';
export type { Attachment as ChatMessageFile } from '../file-thumbnail';
export interface Props<Message> {
  readonly key?: string;
  readonly from: 'user' | 'assistant';
  /** Local File objects or remote { url, mediaType, filename? } parts from a saved conversation or the AI SDK. Remote images render from their URL; failed images and other remote types use a document glyph. Only local PDFs render their first page. */
  readonly files?: readonly FileThumbnail.Attachment[];
  readonly thumbnailSize?: number;
  readonly time?: Html | string;
  readonly actions?: readonly Html[];
  readonly children?: readonly (Html | string)[];
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  /** Use false for existing transcript entries, mirroring initial={false} on
   * the reference's surrounding AnimatePresence. Newly added entries enter. */
  readonly animateEntrance?: boolean;
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const isUser = props.from === 'user',
    showTime = isUser && props.time !== undefined && props.time !== null;
  const body = props.children?.filter((child) => child !== null && child !== '');
  return h.div(
    [
      ...(props.key ? [h.Key(props.key)] : []),
      h.Class('ff-chat-message'),
      h.DataAttribute('from', props.from),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.OnMount(Mounted({ entrance: props.animateEntrance !== false })),
      ...(props.attributes ?? []),
    ],
    [
      props.files?.length
        ? h.div(
            [h.Class('ff-chat-files')],
            props.files.map((file, index) =>
              FileThumbnail.view(
                {
                  file,
                  size: props.thumbnailSize ?? 64,
                  shape: props.radius,
                  attributes: [
                    h.Key(
                      'url' in file
                        ? `${file.url}-${index}`
                        : `${file.name}-${file.size}-${file.lastModified}-${index}`,
                    ),
                  ],
                },
                h,
              ),
            ),
          )
        : null,
      body?.length ? h.div([h.Class('ff-chat-bubble')], body) : null,
      showTime || props.actions !== undefined
        ? h.div(
            [h.Class('ff-chat-meta')],
            [
              showTime ? h.span([h.Class('ff-chat-time')], [props.time ?? null]) : null,
              props.actions !== undefined
                ? h.span([h.Class('ff-chat-actions')], props.actions)
                : null,
            ],
          )
        : null,
    ],
  );
}
