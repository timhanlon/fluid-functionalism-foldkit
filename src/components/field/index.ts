import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import { icon } from '../icons';
import { Mounted } from './runtime';
import './styles.css';
export type Orientation = 'vertical' | 'horizontal' | 'responsive';
export interface Parts<Message> {
  readonly children?: readonly (Html | string | null)[];
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
export interface Props<Message> extends Parts<Message> {
  readonly orientation?: Orientation;
  readonly invalid?: boolean;
  readonly label?: string;
}
const sizeAttributes = <Message>(props: Parts<Message>, h: HtmlBuilder<Message>) => [
  ...(props.size ? [h.DataAttribute('size', props.size)] : []),
  ...(props.radius ? [h.DataAttribute('radius', props.radius)] : []),
];
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-field'),
      h.DataAttribute('slot', 'field'),
      h.DataAttribute('orientation', props.orientation ?? 'vertical'),
      h.DataAttribute('invalid', String(!!props.invalid)),
      ...sizeAttributes(props, h),
      h.OnMount(Mounted()),
      ...(props.label ? [h.Role('group'), h.AriaLabel(props.label)] : []),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function group<Message>(props: Parts<Message>, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-field-group'),
      h.DataAttribute('slot', 'field-group'),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function set<Message>(
  props: Parts<Message> & { readonly disabled?: boolean },
  h: HtmlBuilder<Message>,
): Html {
  return h.fieldset(
    [
      h.Class('ff-field-set'),
      h.DataAttribute('slot', 'field-set'),
      h.Disabled(!!props.disabled),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function legend<Message>(
  props: Parts<Message> & { readonly variant?: 'legend' | 'label' },
  h: HtmlBuilder<Message>,
): Html {
  return h.legend(
    [
      h.Class('ff-field-legend'),
      h.DataAttribute('slot', 'field-legend'),
      h.DataAttribute('variant', props.variant ?? 'legend'),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function label<Message>(
  props: Parts<Message> & { readonly htmlFor?: string },
  h: HtmlBuilder<Message>,
): Html {
  return h.label(
    [
      h.Class('ff-field-label'),
      h.DataAttribute('slot', 'field-label'),
      ...sizeAttributes(props, h),
      ...(props.htmlFor ? [h.For(props.htmlFor), h.Id(`${props.htmlFor}-label`)] : []),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function content<Message>(props: Parts<Message>, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-field-content'),
      h.DataAttribute('slot', 'field-content'),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function title<Message>(props: Parts<Message>, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-field-title'),
      h.DataAttribute('slot', 'field-title'),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function description<Message>(
  props: Parts<Message> & { readonly id: string },
  h: HtmlBuilder<Message>,
): Html {
  return h.p(
    [
      h.Id(props.id),
      h.Class('ff-field-description'),
      h.DataAttribute('slot', 'field-description'),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    props.children ?? [],
  );
}
export function errorMessages(
  errors: readonly ({ readonly message?: string } | undefined)[],
): readonly string[] {
  return [...new Set(errors.flatMap((error) => (error?.message ? [error.message] : [])))];
}
export function error<Message>(
  props: Parts<Message> & {
    readonly id: string;
    readonly errors?: readonly ({ readonly message?: string } | undefined)[];
    readonly icons?: string;
  },
  h: HtmlBuilder<Message>,
): Html | null {
  const messages = errorMessages(props.errors ?? []);
  if (!props.children?.length && !messages.length) return null;
  return h.div(
    [
      h.Id(props.id),
      h.Class('ff-field-error'),
      h.DataAttribute('slot', 'field-error'),
      h.Role('alert'),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    [
      h.span(
        [h.Class('ff-field-error-icon'), h.AriaHidden(true)],
        [icon('circle-alert', props.icons, h)],
      ),
      h.div(
        [h.Class('ff-field-error-content')],
        props.children?.length
          ? props.children
          : messages.length > 1
            ? [
                h.ul(
                  [],
                  messages.map((message) => h.li([], [message])),
                ),
              ]
            : [messages[0]!],
      ),
    ],
  );
}
export function separator<Message>(props: Parts<Message>, h: HtmlBuilder<Message>): Html {
  return h.div(
    [
      h.Class('ff-field-separator'),
      h.DataAttribute('slot', 'field-separator'),
      ...sizeAttributes(props, h),
      ...(props.attributes ?? []),
    ],
    [
      h.div([h.Class('ff-field-separator-line'), h.AriaHidden(true)], []),
      props.children?.length ? h.span([h.Class('ff-field-separator-text')], props.children) : null,
    ],
  );
}
