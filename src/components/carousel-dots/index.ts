import { Mount } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { Mounted } from './runtime';
import './styles.css';
export interface Autoplay {
  readonly duration?: number;
  readonly paused?: boolean;
  readonly loop?: boolean;
}
export type ChangeSource = 'manual' | 'autoplay';
export interface Props<Message> {
  readonly count: number;
  readonly value: number;
  readonly onValueChange: (value: number, source: ChangeSource) => Message;
  readonly autoplay?: boolean | Autoplay;
  /** An externally controlled clock, clamped to [0,1], takes precedence. */
  readonly progress?: number;
  readonly getLabel?: (index: number) => string;
  readonly label?: string;
  /** Sharp squares dots, fills and hover highlights; other shapes keep them round. */
  readonly radius?: 'rounded' | 'pill' | 'sharp';
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  const playback = typeof props.autoplay === 'object' ? props.autoplay : {};
  const count = Number.isFinite(props.count) ? Math.max(0, Math.floor(props.count)) : 0;
  return h.div(
    [
      h.Class('ff-carousel-dots'),
      h.Role('group'),
      h.AriaLabel(props.label ?? 'Slides'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('count', String(count)),
      h.DataAttribute('value', String(props.value)),
      h.DataAttribute('autoplay', String(!!props.autoplay)),
      h.DataAttribute('duration', String(playback.duration ?? 3000)),
      h.DataAttribute('paused', String(!!playback.paused)),
      h.DataAttribute('loop', String(playback.loop !== false)),
      h.DataAttribute('progress', props.progress === undefined ? '' : String(props.progress)),
      h.OnMount(
        Mount.mapMessage(Mounted(), (message) => props.onValueChange(message.value, 'autoplay')),
      ),
    ],
    Array.from({ length: count }, (_, index) =>
      h.button(
        [
          h.Key(String(index)),
          h.Type('button'),
          h.Class('ff-carousel-dot'),
          h.AriaLabel(props.getLabel?.(index) ?? `Go to slide ${index + 1}`),
          ...(index === props.value ? [h.Attribute('aria-current', 'true')] : []),
          h.OnClick(props.onValueChange(index, 'manual')),
        ],
        [
          h.span(
            [h.Class('ff-carousel-track'), h.AriaHidden(true)],
            [index === props.value ? h.span([h.Class('ff-carousel-fill')], []) : null],
          ),
        ],
      ),
    ),
  );
}
