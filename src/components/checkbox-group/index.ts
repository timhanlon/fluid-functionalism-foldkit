import { shapeRadius } from '../shape';
import { Effect, Schema } from 'effect';
import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { mountListFocus } from '../list-focus';
import { mountHover } from '../../fluid-hover/engine';
import { mountSelections } from '../selection-backgrounds/runtime';
import '../checkbox/styles.css';

const Mounted = Mount.define('CheckboxGroup.Mount', {
  messages: [Schema.Never],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        if (!(element instanceof HTMLElement)) return () => {};
        const root = element;
        const rows = () =>
          [...root.querySelectorAll<HTMLElement>('.ff-checkbox')].filter(
            (row) => row.closest('.ff-checkbox-group') === root,
          );
        const hover = mountHover(root, {
          itemSelector: '.ff-checkbox',
          ownsItem: (row) => row.closest('.ff-checkbox-group') === root,
          nearest: false,
          axis: 'y',
          radius: () => `${shapeRadius(root.dataset.radius, 8, 20, 1)}px`,
        });
        const selections = mountSelections(root, rows);
        const disposeFocus = mountListFocus(root, rows);
        const key = (event: KeyboardEvent) => {
          const available = rows().filter((row) => !row.matches(':disabled'));
          const index = available.indexOf(event.target as HTMLElement);
          if (index < 0) return;
          let next: number;
          if (event.key === 'ArrowDown') next = (index + 1) % available.length;
          else if (event.key === 'ArrowUp')
            next = (index - 1 + available.length) % available.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = available.length - 1;
          else return;
          event.preventDefault();
          available[next]?.focus();
        };
        root.addEventListener('keydown', key);
        return () => {
          hover.dispose();
          selections();
          disposeFocus();
          root.removeEventListener('keydown', key);
        };
      }),
      (dispose) => Effect.sync(dispose),
    ).pipe(Effect.andThen(Effect.never)),
});
export interface Props {
  readonly children: readonly Html[];
  readonly label: string;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
}
export function view<Message>(props: Props, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-checkbox-group'),
      h.Role('group'),
      h.AriaLabel(props.label),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.OnMount(Mounted()),
    ],
    props.children,
  );
}
