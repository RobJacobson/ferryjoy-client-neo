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

export type { ConvexActualDockEvent };
export { eventsActualSchema };
