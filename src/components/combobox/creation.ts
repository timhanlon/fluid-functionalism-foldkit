import { createCandidate } from '../options';
import type { Item } from './field';
import type { CommonProps } from './field';
import type { HtmlBuilder } from 'foldkit/html';
import { icon } from '../icons';
import { itemLabel, itemValue, type ItemData } from './item';
export const candidate = (items: readonly (string | { readonly label: string })[], query: string) =>
  createCandidate(
    items.map((item) => ({ label: itemLabel(item) })),
    query,
    (value) => value.toLocaleLowerCase(),
  );
export function creation(
  items: readonly ItemData[],
  query: string,
  enabled = false,
): { readonly query: string; readonly value: string } | undefined {
  const label = enabled ? candidate(items, query) : undefined;
  if (!label) return;
  let value = '\u0000ff-combobox-create';
  while (items.some((item) => itemValue(item) === value)) value += ':';
  return { query: label, value };
}
export function creationItem<Message>(
  create: { readonly query: string; readonly value: string },
  props: Pick<CommonProps, 'createLabel' | 'createIcon' | 'icons'>,
  h: HtmlBuilder<Message>,
): Item {
  return {
    value: create.value,
    label: props.createLabel?.(create.query) ?? `Create “${create.query}”`,
    icon: props.createIcon === undefined ? icon('plus', props.icons, h) : props.createIcon,
  };
}
