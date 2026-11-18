import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import './styles.css';
export type Tone = 'default' | 'inverted';
export interface Props<M> {
  readonly children: readonly (Html | string)[];
  readonly tone?: Tone;
  readonly className?: string;
  readonly attributes?: readonly (Attribute<M> | ChildAttribute)[];
}
export interface KeysProps<M> extends Omit<Props<M>, 'children'> {
  /** Split a combo, or preserve a name with spaces by passing an array. */
  readonly keys: string | readonly string[];
}
/** Fluid f801409: modifiers and plus/space separators; a trailing + is a key. */
export const splitKeys = (combo: string): string[] => combo.match(/[⌘⇧⌥⌃]|[^⌘⇧⌥⌃+\s]+|\+$/g) ?? [];
export function view<M>(props: Props<M>, h: HtmlBuilder<M>): Html {
  const child = props.children.length === 1 ? props.children[0] : undefined;
  const glyph = typeof child === 'string' && !/[a-z0-9]/i.test(child);
  return h.kbd(
    [
      h.Class(`ff-key-cap ${props.className ?? ''}`),
      h.DataAttribute('tone', props.tone ?? 'default'),
      h.DataAttribute('glyph', String(glyph)),
      ...(props.attributes ?? []),
    ],
    props.children,
  );
}
export function keys<M>(props: KeysProps<M>, h: HtmlBuilder<M>): Html {
  const keys = typeof props.keys === 'string' ? splitKeys(props.keys) : props.keys;
  return h.span(
    [h.Class(`ff-key-caps ${props.className ?? ''}`), ...(props.attributes ?? [])],
    keys.map((key, index) =>
      view({ children: [key], tone: props.tone, attributes: [h.Key(`${key}-${index}`)] }, h),
    ),
  );
}
