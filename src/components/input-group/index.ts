import { defineSilentMount } from '../silent-mount';
import { Effect } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { mountHover } from '../../fluid-hover/engine';
import '../input-field/styles.css';

const Mounted = defineSilentMount('InputGroup.Mount', {
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() =>
        element instanceof HTMLElement
          ? mountHover(element, {
              itemSelector: '[data-input-field]',
              axis: 'y',
              nearest: false,
              renderHighlight: false,
              ownsItem: (item) => item.closest('.ff-input-group') === element,
            }).dispose
          : () => {},
      ),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});

export interface Props {
  readonly children: readonly Html[];
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly className?: string;
}

export function view<Message>(props: Props, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class(`ff-input-group ${props.className ?? ''}`),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.OnMount(Mounted()),
    ],
    props.children,
  );
}
