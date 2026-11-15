import { Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import * as Tooltip from '../tooltip';
export const Message = defineMessageUnion({
  Edited: { id: Schema.String },
  Removed: { id: Schema.String },
  /** From the runtime while a card drags between slots. */
  Reordered: { ids: Schema.Array(Schema.String) },
  Tip: { key: Schema.String, message: Tooltip.Message },
});
export type Message = typeof Message.Type;
