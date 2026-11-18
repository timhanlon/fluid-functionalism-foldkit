import { Submodel } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import * as Button from '../button';
import { icon } from '../icons';
import { Model, Message } from './state';
import { Mounted, defaultMotion, type MotionConfig } from './runtime';
import './styles.css';
export { Model, Message, OutMessage, init, update } from './state';
export { defaultMotion, type MotionConfig } from './runtime';
export type Status = 'default' | 'info' | 'success' | 'warning' | 'error';
export type ActionVariant = 'primary' | 'secondary' | 'ghost';
export interface Props {
  readonly title: Html | string;
  readonly description?: Html | string;
  readonly role?: 'group' | 'status' | 'alert';
  readonly titleId?: string;
  readonly descriptionId?: string;
  readonly className?: string;
  readonly status?: Status;
  readonly contrast?: 'low' | 'high';
  readonly variant?: 'inline' | 'fixed';
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly icon?: Html;
  readonly dismissible?: boolean;
  readonly dismissLabel?: string;
  readonly motion?: MotionConfig;
  readonly renderActions?: (h: HtmlBuilder<Message>) => readonly Html[];
}
export function action<Message>(
  props: Button.Props<Message> & { readonly variant?: ActionVariant },
  h: HtmlBuilder<Message>,
): Html {
  return Button.view(
    {
      ...props,
      variant: props.variant ?? 'secondary',
      size: 'compact',
      className: `ff-banner-action ${props.className ?? ''}`,
      attributes: [
        ...(props.attributes ?? []),
        h.DataAttribute('banner-action', props.variant ?? 'secondary'),
      ],
    },
    h,
  );
}
const tones: Record<Status, string> = {
  default: 'var(--foreground)',
  info: 'var(--info)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--destructive)',
};
function glyph(status: Status, icons: string | undefined, h: HtmlBuilder<Message>): Html {
  if (status === 'default') return icon('info', icons, h);
  return h.svg(
    [h.ViewBox('0 0 24 24'), h.Fill('none'), h.AriaHidden(true)],
    [
      status === 'warning'
        ? h.path(
            [
              h.D('m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z'),
              h.Fill('currentColor'),
              h.Stroke('currentColor'),
              h.StrokeWidth('1.5'),
              h.StrokeLinejoin('round'),
            ],
            [],
          )
        : h.circle([h.Cx('12'), h.Cy('12'), h.R('10.5'), h.Fill('currentColor')], []),
      h.path(
        [
          h.D(
            status === 'success'
              ? 'm8.5 12.25 2.5 2.5 4.5-5'
              : status === 'warning'
                ? 'M12 9.5v3.5M12 17h.01'
                : status === 'error'
                  ? 'M12 7.5v5M12 16.5h.01'
                  : 'M12 16.5v-5M12 7.5h.01',
          ),
          h.Stroke('var(--background)'),
          h.StrokeWidth('2.25'),
          h.StrokeLinecap('round'),
          h.StrokeLinejoin('round'),
        ],
        [],
      ),
    ],
  );
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  if (!model.isShowing && model.transitionState === 'Idle')
    return h.div([h.Id(model.id), h.Style({ display: 'none' })], []);
  const status = props.status ?? 'default',
    described = props.description !== undefined && props.description !== null,
    fixed = props.variant === 'fixed';
  return h.div(
    [
      h.Id(model.id),
      h.Class('ff-banner-row'),
      h.DataAttribute('variant', props.variant ?? 'inline'),
      h.DataAttribute('banner-phase', model.transitionState),
      h.DataAttribute('banner-generation', String(model.transitionGeneration)),
      h.OnMount(Mounted({ config: props.motion ?? defaultMotion, fixed })),
    ],
    [
      h.div(
        [h.Class('ff-banner-clip')],
        [
          h.div(
            [h.Class('ff-banner-motion')],
            [
              h.div(
                [
                  h.Class(`ff-banner ${props.className ?? ''}`),
                  h.Role(
                    props.role ?? (status === 'error' || status === 'warning' ? 'alert' : 'status'),
                  ),
                  ...(props.titleId ? [h.Attribute('aria-labelledby', props.titleId)] : []),
                  ...(described && props.descriptionId
                    ? [h.Attribute('aria-describedby', props.descriptionId)]
                    : []),
                  ...(described ? [h.DataAttribute('described', '')] : []),
                  h.DataAttribute('slot', 'banner'),
                  h.DataAttribute('status', status),
                  h.DataAttribute('contrast', props.contrast ?? 'low'),
                  h.DataAttribute('variant', props.variant ?? 'inline'),
                  h.DataAttribute('size', props.size ?? 'default'),
                  h.DataAttribute('radius', props.radius ?? 'rounded'),
                  h.Style({ '--banner-tone': tones[status] }),
                ],
                [
                  h.span(
                    [h.Class('ff-banner-icon'), h.AriaHidden(true)],
                    [props.icon ?? glyph(status, props.icons, h)],
                  ),
                  h.p(
                    [
                      h.Class('ff-banner-title'),
                      h.DataAttribute('slot', 'banner-title'),
                      ...(props.titleId ? [h.Id(props.titleId)] : []),
                    ],
                    [props.title],
                  ),
                  described
                    ? h.p(
                        [
                          h.Class('ff-banner-description'),
                          h.DataAttribute('slot', 'banner-description'),
                          ...(props.descriptionId ? [h.Id(props.descriptionId)] : []),
                        ],
                        [props.description],
                      )
                    : null,
                  props.renderActions
                    ? h.div([h.Class('ff-banner-actions')], props.renderActions(h))
                    : null,
                  props.dismissible
                    ? Button.view(
                        {
                          children: [icon('x', props.icons, h)],
                          label: props.dismissLabel ?? 'Dismiss',
                          variant: 'ghost',
                          size: 'icon-compact',
                          radius: props.radius,
                          className: 'ff-banner-dismiss',
                          onClick: Message.Dismissed(),
                        },
                        h,
                      )
                    : null,
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
