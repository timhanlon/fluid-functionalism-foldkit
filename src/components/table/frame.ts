import { Schema } from 'effect';
import { CustomElement } from 'foldkit';

/** The fill's current position in table coordinates, including its live fade. */
export interface HighlightFrame {
  readonly y: number;
  readonly height: number;
  readonly opacity: number;
}

/** Foldkit Prop refreshes this client-only view input on the native root. */
export const frameCallbackProperty = 'ffTableHighlightFrame';
export type HighlightListener = (box: HighlightFrame, element: HTMLElement) => void;
export const FrameSurface = CustomElement.define({
  tag: 'ff-table-surface',
  properties: {
    [frameCallbackProperty]: Schema.declare<HighlightListener | undefined>(
      (value): value is HighlightListener | undefined =>
        value === undefined || typeof value === 'function',
    ),
  },
  events: {},
});
export type FrameElement = HTMLElement & {
  [frameCallbackProperty]?: HighlightListener;
};
