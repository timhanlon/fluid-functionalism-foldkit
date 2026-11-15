import { Schema } from 'effect';
import type { DateRange } from '../calendar';
/** Stored times use local HH:mm, without a date or timezone conversion. */
export const TimeRange = Schema.Struct({ start: Schema.String, end: Schema.String });
export interface TimeRange extends Schema.Schema.Type<typeof TimeRange> {}
export interface Preset {
  readonly label: string;
  readonly range: DateRange;
}
