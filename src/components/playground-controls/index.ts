import { shapeRadius } from '../shape';
import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { mountHover } from '../../fluid-hover/engine';
import * as Button from '../button';
import './styles.css';
const PlacementChanged = Schema.TaggedStruct('PlacementChanged', { isRail: Schema.Boolean });
export const PlacementObserved = Mount.defineStream('Playground.Placement', {
  messages: [PlacementChanged],
  execute: () =>
    Stream.callback<typeof PlacementChanged.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const query = matchMedia('(min-width:1280px)');
          const sync = () =>
            Queue.offerUnsafe(queue, { _tag: 'PlacementChanged', isRail: query.matches });
          sync();
          query.addEventListener('change', sync);
          return () => query.removeEventListener('change', sync);
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});

const Mounted = Mount.define('Playground.Controls', {
  args: { previewId: Schema.String, observePreview: Schema.Boolean },
  messages: [Schema.Never],
  execute: ({ element, previewId, observePreview }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const rows = element.querySelector<HTMLElement>('.ff-playground-rows') ?? element;
        const hover = mountHover(rows, {
          itemSelector: '.ff-playground-field .ff-select-trigger,.ff-playground-switch',
          nearest: true,
          axis: 'y',
          keyboardNavigation: false,
          radius: () => `${shapeRadius(element.dataset.radius, 8, 20, 1)}px`,
        });
        const preview = document.getElementById(previewId);
        const observer =
          observePreview && preview
            ? new IntersectionObserver(
                ([entry]) => {
                  element.dataset.shown = String(!!entry?.isIntersecting);
                  element.inert = !entry?.isIntersecting;
                },
                { rootMargin: '0px 0px -20% 0px' },
              )
            : undefined;
        if (preview) observer?.observe(preview);
        return () => {
          observer?.disconnect();
          hover.dispose();
        };
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.andThen(Effect.never)),
});
export interface Props<Message> {
  readonly title?: string;
  readonly children: readonly Html[];
  readonly onShuffle: Message;
  readonly previewId: string;
  readonly placement: 'inline' | 'rail' | 'menu';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-playground-controls'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('shown', 'true'),
      h.DataAttribute('placement', props.placement),
      h.OnMount(
        Mounted({ previewId: props.previewId, observePreview: props.placement === 'rail' }),
      ),
    ],
    [
      h.div(
        [h.Class('ff-playground-heading')],
        [
          h.h2([], [props.title ?? 'Playground variant']),
          Button.view(
            {
              children: [h.kbd([h.AriaHidden(true)], ['X'])],
              variant: 'ghost',
              className: 'ff-playground-shuffle',
              radius: props.radius,
              attributes: [h.Attribute('aria-keyshortcuts', 'X')],
              label: 'Shuffle the playground',
              onClick: props.onShuffle,
              trailingIcon: h.svg(
                [
                  h.ViewBox('0 0 24 24'),
                  h.Fill('none'),
                  h.Stroke('currentColor'),
                  h.StrokeWidth('1.5'),
                  h.StrokeLinecap('round'),
                  h.StrokeLinejoin('round'),
                  h.AriaHidden(true),
                ],
                [
                  h.path(
                    [
                      h.D(
                        'm18 14 4 4-4 4m0-20 4 4-4 4M2 18h2.5a6 6 0 0 0 5-2.7l5-7.6A6 6 0 0 1 19.5 5H22M2 6h2.5a6 6 0 0 1 5 2.7l5 7.6a6 6 0 0 0 5 2.7H22',
                      ),
                    ],
                    [],
                  ),
                ],
              ),
            },
            h,
          ),
        ],
      ),
      h.div([h.Class('ff-playground-hairline'), h.AriaHidden(true)], []),
      h.div([h.Class('ff-playground-rows')], props.children),
    ],
  );
}
