import { itemLabel } from './item';
export type SearchItem = string | { readonly label: string };
export type Filter<Item extends SearchItem = SearchItem> = (item: Item, query: string) => boolean;

// Base UI's default filter used by Fluid Functionalism: Intl.Collator search
// with base sensitivity and punctuation ignored, over label substrings.
const collator = new Intl.Collator(undefined, {
  usage: 'search',
  sensitivity: 'base',
  ignorePunctuation: true,
});
export const defaultFilter: Filter = (item, query) => {
  if (!query) return true;
  const label = itemLabel(item);
  for (let index = 0; index <= label.length - query.length; index++)
    if (collator.compare(label.slice(index, index + query.length), query) === 0) return true;
  return false;
};

export function matches<Item extends SearchItem>(
  items: readonly Item[],
  query: string,
  filter: Filter<Item> = defaultFilter,
  selectedLabel?: string,
): readonly Item[] {
  const trimmed = query.trim();
  if (!trimmed) return items;
  // The default single-select filter keeps all choices when the query is
  // the selected label. Consumer filters retain control of that decision.
  if (
    filter === defaultFilter &&
    selectedLabel &&
    selectedLabel.length === trimmed.length &&
    defaultFilter({ label: selectedLabel }, trimmed)
  )
    return items;
  return items.filter((item) => filter(item, trimmed));
}
