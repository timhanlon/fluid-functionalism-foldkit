import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { Mounted, Wanted } from './runtime';
import './highlighted.css';
export interface HighlightProps<Message> {
  readonly code: string;
  readonly minHeight?: string;
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
/** The mounted highlighter owns this empty DOM boundary; Foldkit owns its
 * source and geometry. Async results cannot overwrite a later configuration. */
export function highlighted<Message>(
  props: HighlightProps<Message>,
  h: HtmlBuilder<Message>,
): Html {
  return h.div(
    [
      h.Class('ff-code-highlight'),
      h.DataAttribute('source', props.code),
      h.Style({ '--ff-code-min-height': props.minHeight ?? '120px' }),
      h.OnMount(Mounted()),
      ...(props.attributes ?? []),
    ],
    [],
  );
}

export function readerIntent<Message>(h: HtmlBuilder<Message>): Html {
  return h.span(
    [
      h.Key('code-reader-intent'),
      h.Style({ display: 'none' }),
      h.AriaHidden(true),
      h.OnMount(Wanted()),
    ],
    [],
  );
}
