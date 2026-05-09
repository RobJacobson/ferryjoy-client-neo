/**
 * Convex validators and wire types for eventsActual.
 *
 * The actual table stores observed dock boundary rows. Rows are keyed by a
 * physical event key and remain close to the persisted Convex shape.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "../common/schemas";

const eventsActualSchema = v.object({
  EventKey: v.string(),
  TripKey: v.string(),
  EventType: dockEventTypeSchema,
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  UpdatedAt: v.number(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventOccurred: v.optional(v.literal(true)),
  EventActualTime: v.optional(v.number()),
});

type ConvexActualDockEvent = Infer<typeof eventsActualSchema>;

/**
 * Reload wire: WSF vessel history row with numeric timestamps from the sync action.
 */
const reloadDockHistoryRecordSchema = v.object({
  VesselId: v.number(),
  Vessel: v.optional(v.string()),
  Departing: v.optional(v.string()),
  Arriving: v.optional(v.string()),
  ScheduledDepart: v.optional(v.number()),
  ActualDepart: v.optional(v.number()),
  EstArrival: v.optional(v.number()),
});

type ConvexReloadDockHistoryRecord = Infer<
  typeof reloadDockHistoryRecordSchema
>;

export type { ConvexActualDockEvent, ConvexReloadDockHistoryRecord };
export { eventsActualSchema, reloadDockHistoryRecordSchema };
