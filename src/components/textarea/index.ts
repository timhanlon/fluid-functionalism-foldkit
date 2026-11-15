import type { ChildAttribute, Html, HtmlBuilder, TextareaAttribute } from 'foldkit/html';
import '../input/styles.css';
import './styles.css';
export interface Props<Message> {
  readonly id: string;
  readonly value: string;
  readonly onInput?: (value: string) => Message;
  readonly placeholder?: string;
  readonly name?: string;
  readonly ariaLabel?: string;
  readonly describedBy?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly invalid?: boolean;
  readonly required?: boolean;
  readonly maxLength?: number;
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly attributes?: readonly (TextareaAttribute<Message> | ChildAttribute)[];
}
export function view<Message>(props: Props<Message>, h: HtmlBuilder<Message>): Html {
  return h.textarea([
    h.Id(props.id),
    h.Class('ff-textarea'),
    h.DataAttribute('slot', 'textarea'),
    h.Value(props.value),
    h.DataAttribute('size', props.size ?? 'default'),
    h.DataAttribute('radius', props.radius ?? 'rounded'),
    h.Disabled(!!props.disabled),
    h.Readonly(!!props.readOnly),
    ...(props.invalid ? [h.AriaInvalid(true)] : []),
    ...(props.name ? [h.Name(props.name)] : []),
    ...(props.ariaLabel ? [h.AriaLabel(props.ariaLabel)] : []),
    ...(props.describedBy ? [h.AriaDescribedBy(props.describedBy)] : []),
    ...(props.placeholder ? [h.Placeholder(props.placeholder)] : []),
    ...(props.required ? [h.Required(true)] : []),
    ...(props.maxLength !== undefined ? [h.Maxlength(props.maxLength)] : []),
    ...(props.onInput && !props.disabled && !props.readOnly ? [h.OnInput(props.onInput)] : []),
    ...(props.attributes ?? []),
  ]);
}
