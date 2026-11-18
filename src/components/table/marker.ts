import { Schema } from 'effect';
import { CustomElement } from 'foldkit';
import type { Html } from 'foldkit/html';

export interface HoverMarker {
  readonly index: number;
  readonly content: Html;
}

/** A property update precedes this store's child patch. Its scoped native
 * adapter returns the carried VNode to its owner before that patch begins. */
export const markerRenderProperty = 'ffTableMarkerRender';
export const MarkerStore = CustomElement.define({
  tag: 'ff-table-marker-store',
  properties: { [markerRenderProperty]: Schema.Unknown },
  events: {},
});
