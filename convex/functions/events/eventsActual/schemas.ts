/**
 * Convex validators for `eventsActual`: observed dock-side events (departure /
 * arrival instants tied to legs). Built from vessel/trip updates and schedule
 * hydration; consumed next to `eventsScheduled` and `eventsPredicted` for
 * timelines. Sparse upstream shapes live under `domain/events/actual`.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import { dockEventTypeSchema } from "../eventsScheduled/schemas";

/**
 * Persisted row fields (physical `TripKey` required).
 */
const persistedActualDockFields = {
  TripKey: v.string(),
  ScheduleKey: v.optional(v.string()),
  VesselAbbrev: v.string(),
  SailingDay: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
  EventActualTime: v.optional(v.number()),
} as const;

/**
 * Convex validator for one persisted `eventsActual` document.
 *
 * Physical identity is `EventKey`; `EventType` is first-class. Optional
 * `ScheduleKey` ties the row to schedule continuity without replacing physical keys.
 */
export const eventsActualSchema = v.object({
  ...persistedActualDockFields,
  EventKey: v.string(),
  EventType: dockEventTypeSchema,
  UpdatedAt: v.number(),
  EventOccurred: v.optional(v.literal(true)),
});

export type ConvexActualDockEvent = Infer<typeof eventsActualSchema>;
