import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { fileIdentity } from './object-urls';
import { Mounted } from './runtime';
import './styles.css';
export { loadPdfjs, renderPdfFirstPage, setPdfWorkerSrc } from './pdf';
export interface Props<Message> {
  readonly file: File;
  readonly size: number;
  readonly radius?: number;
  readonly shape?: 'rounded' | 'pill' | 'sharp';
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const kind = props.file.type.startsWith('image/')
    ? 'image'
    : props.file.type === 'application/pdf'
      ? 'pdf'
      : 'file';
  return h.div(
    [
      h.Class('ff-file-thumbnail'),
      h.DataAttribute('file', fileIdentity(props.file)),
      h.DataAttribute('kind', kind),
      h.DataAttribute('size', String(props.size)),
      h.DataAttribute('shape', props.shape ?? 'rounded'),
      { _tag: 'Prop', key: 'ffThumbnailFile', value: props.file },
      h.Style({
        width: `${props.size}px`,
        height: `${props.size}px`,
        ...(props.radius === undefined ? {} : { borderRadius: `${props.radius}px` }),
      }),
      h.OnMount(Mounted()),
      ...(props.attributes ?? []),
    ],
    [
      h.div([h.Class('ff-thumbnail-preview')], []),
      h.div(
        [h.Class('ff-thumbnail-loading')],
        [
          h.div(
            [h.Class('ff-thumbnail-spinner'), h.AriaLabel('Loading preview'), h.Role('status')],
            [],
          ),
        ],
      ),
      h.div(
        [h.Class('ff-thumbnail-fallback'), h.Role('img'), h.AriaLabel(props.file.name)],
        [
          h.svg(
            [
              h.Width(String(Math.max(16, props.size * 0.35))),
              h.Height(String(Math.max(16, props.size * 0.35))),
              h.ViewBox('0 0 24 24'),
              h.Fill('none'),
              h.Stroke('currentColor'),
              h.StrokeWidth('1.5'),
              h.StrokeLinecap('round'),
              h.StrokeLinejoin('round'),
              h.AriaHidden(true),
            ],
            [
              h.path([h.D('M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z')], []),
              h.path([h.D('M14 3v5h5')], []),
            ],
          ),
        ],
      ),
    ],
  );
}
