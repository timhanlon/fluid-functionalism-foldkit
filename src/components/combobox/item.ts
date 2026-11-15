import type { Html } from 'foldkit/html';

export interface Item {
  readonly value: string;
  readonly label: string;
  readonly icon?: Html;
  readonly disabled?: boolean;
}
export type ItemData = string | Item;
export const itemLabel = (item: string | { readonly label: string }): string =>
  typeof item === 'string' ? item : item.label;
export const itemValue = (item: ItemData): string => (typeof item === 'string' ? item : item.value);
export const itemDisabled = (item: ItemData): boolean =>
  typeof item !== 'string' && !!item.disabled;
