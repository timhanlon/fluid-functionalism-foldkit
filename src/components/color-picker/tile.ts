import type { ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';

const checker = {
  backgroundImage:
    'conic-gradient(var(--checker-a) 0 25%, var(--checker-b) 0 50%, var(--checker-a) 0 75%, var(--checker-b) 0)',
  backgroundSize: '8px 8px',
};

/** Upstream's ColorTile: the color on a layer over an 8px checker, an inset
 * 25% gray hairline so white or near-transparent colors keep an edge. */
export function tile<Message>(
  props: {
    readonly color: string;
    readonly size?: number;
    readonly radius?: 'rounded' | 'pill' | 'sharp';
    readonly attributes?: readonly ChildAttribute[];
  },
  h: HtmlBuilder<Message>,
): Html {
  const size = `${props.size ?? 24}px`;
  return h.span(
    [
      ...(props.attributes ?? []),
      h.Class('ff-cp-tile'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.Style({ width: size, height: size, ...checker }),
    ],
    [h.span([h.Class('ff-cp-chip-color'), h.Style({ backgroundColor: props.color })], [])],
  );
}

/** Upstream's ColorSwatch: a clickable tile whose ring (2px gap in the page
 * background, then 2px of accent when selected or 40% gray on hover) stays
 * readable on any color. */
export function swatch<Message>(
  props: {
    readonly color: string;
    readonly size?: number;
    readonly selected?: boolean;
    readonly radius?: 'rounded' | 'pill' | 'sharp';
    readonly attributes?: readonly ChildAttribute[];
  },
  h: HtmlBuilder<Message>,
): Html {
  const size = `${props.size ?? 28}px`;
  return h.button(
    [
      h.Type('button'),
      h.AriaLabel(`Select color ${props.color}`),
      ...(props.attributes ?? []),
      h.Class('ff-cp-tile ff-cp-color-swatch'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      ...(props.selected ? [h.DataAttribute('selected', '')] : []),
      h.Style({ width: size, height: size, ...checker }),
    ],
    [h.span([h.Class('ff-cp-chip-color'), h.Style({ backgroundColor: props.color })], [])],
  );
}
