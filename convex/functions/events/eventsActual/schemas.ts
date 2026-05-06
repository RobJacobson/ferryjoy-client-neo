/**
 * Convex validators and wire types for eventsActual.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "../common/schemas";

/**
 * Persisted row fields (physical TripKey required).
 */
const persistedActualDockFields = {
  TripKey: v.string(),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventActualTime: v.optional(v.number()),
} as const;

/**
 * Convex validator for one persisted eventsActual document.
 *
 * Physical identity is EventKey; EventType is first-class so departures and
 * arrivals stay independent under the same trip.
 */
const eventsActualSchema = v.object({
  ...persistedActualDockFields,
  EventKey: v.string(),
  EventType: dockEventTypeSchema,
  UpdatedAt: v.number(),
  EventOccurred: v.optional(v.literal(true)),
});

export type ConvexActualDockEvent = Infer<typeof eventsActualSchema>;
export { eventsActualSchema };
