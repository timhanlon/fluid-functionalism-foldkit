import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { Mounted, Wanted } from './runtime';
import './styles.css';
export interface Props<Message> {
  readonly code: string;
  readonly minHeight?: string;
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
/** The mounted highlighter owns this empty DOM boundary; Foldkit owns its
 * source and geometry. Async results cannot overwrite a later configuration. */
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-code-block'),
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
