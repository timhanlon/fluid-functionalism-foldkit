import { Submodel } from 'foldkit';
import type { Html } from 'foldkit/html';
import * as Button from '../button';
import * as Tooltip from '../tooltip';
import * as ScrollArea from '../scroll-area';
import { icon } from '../icons';
import { Message, type Model } from './state';
import './styles.css';
export { Model, Message, OutMessage, init, update, Copy, Clear } from './state';

/** Fluid Functionalism f801409: pass highlighted children; code remains the
 * exact clipboard payload. The public view does not run a highlighter. */
export interface Props {
  readonly code: string;
  readonly language?: string;
  readonly title?: Html | string;
  readonly children?: readonly (Html | string)[];
  /** Use this top-level slot when content carries parent Messages or Mounts. */
  readonly renderContent?: () => readonly (Html | string)[];
  readonly lineNumbers?: boolean;
  readonly wrap?: boolean;
  readonly maxHeight?: number;
  readonly hideHeader?: boolean;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly className?: string;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const label = model.shown ? (model.result === 'copied' ? 'Copied' : 'Copy failed') : 'Copy';
  const copy = () =>
    h.span(
      [h.Class('ff-code-copy-slot')],
      [
        h.submodel({
          slotId: 'copy-tooltip',
          model: model.tooltip,
          view: Tooltip.view,
          toParentMessage: (message) => Message.Tooltip({ message }),
          viewInputs: {
            content: label,
            radius: props.radius,
            renderTrigger: (attributes) =>
              Button.view(
                {
                  label: 'Copy code',
                  variant: 'ghost',
                  size: 'icon-compact',
                  radius: props.radius,
                  onClick: Message.CopyRequested(),
                  className: 'ff-code-copy',
                  attributes,
                  children: [
                    h.span(
                      [
                        h.Class('ff-code-glyphs'),
                        h.AriaHidden(true),
                        h.DataAttribute('shown', String(model.shown)),
                        h.DataAttribute('result', model.result),
                      ],
                      [
                        h.span([h.Class('ff-code-copy-glyph')], [icon('copy', props.icons, h)]),
                        h.span(
                          [h.Class('ff-code-result-glyph')],
                          [
                            h.svg(
                              [
                                h.Width('14'),
                                h.Height('14'),
                                h.ViewBox('2 4 20 16'),
                                h.Fill('none'),
                                h.Stroke('currentColor'),
                                h.StrokeWidth('2'),
                                h.StrokeLinecap('round'),
                                h.StrokeLinejoin('round'),
                              ],
                              [
                                h.path(
                                  [
                                    h.Key(String(model.feedbackRevision)),
                                    h.D(
                                      model.result === 'error'
                                        ? 'M9 9L15 15M15 9L9 15'
                                        : 'M6 12L10 16L18 8',
                                    ),
                                    h.Attribute('pathLength', '1'),
                                  ],
                                  [],
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                },
                h,
              ),
          },
        }),
        h.span(
          [h.Class('sr-only'), h.Role('status'), h.Attribute('aria-live', 'polite')],
          [model.shown ? label : ''],
        ),
      ],
    );
  const lines = props.code.replace(/\n$/, '').split('\n');
  const children = props.renderContent?.() ??
    props.children ?? [
      h.pre(
        [],
        [
          h.code(
            [],
            props.lineNumbers
              ? lines.map((line, i) =>
                  h.span(
                    [h.Class('ff-code-line')],
                    [
                      h.span(
                        [
                          h.Class('ff-code-line-number'),
                          h.AriaHidden(true),
                          h.Style({ width: `${String(lines.length).length}ch` }),
                        ],
                        [String(i + 1)],
                      ),
                      h.span([h.Class('ff-code-line-text')], [line || '\n']),
                    ],
                  ),
                )
              : [props.code],
          ),
        ],
      ),
    ];
  return h.div(
    [
      h.Class(`ff-code-block ${props.className ?? ''}`),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('wrap', String(!!props.wrap)),
      h.DataAttribute('hide-header', String(!!props.hideHeader)),
      h.OnUnmount(Message.Unmounted()),
    ],
    [
      props.hideHeader
        ? h.div([h.Class('ff-code-floating-copy')], [copy()])
        : h.div(
            [h.Class('ff-code-header')],
            [h.span([h.Class('ff-code-heading')], [props.title ?? props.language ?? '']), copy()],
          ),
      ScrollArea.view(
        {
          orientation: 'both',
          radius: props.radius,
          viewportClassName: props.maxHeight
            ? 'ff-code-viewport ff-scroll-fade'
            : 'ff-code-viewport ff-scroll-fade-x',
          style: props.maxHeight ? `--code-max-height:${props.maxHeight}px` : undefined,
          children: [h.div([h.Class('ff-code-body')], children)],
        },
        h,
      ),
    ],
  );
});
