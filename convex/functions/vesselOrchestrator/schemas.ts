/**
 * Validators and TypeScript shapes used by the vessel orchestrator.
 */

import type { Infer } from "convex/values";
import { v } from "convex/values";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export const compactScheduledDepartureEventSchema = v.object({
  Key: v.string(),
  ScheduledDeparture: v.number(),
  TerminalAbbrev: v.string(),
});

export const inferredScheduledSegmentSchema = v.object({
  Key: v.string(),
  SailingDay: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  DepartingTime: v.number(),
  NextKey: v.optional(v.string()),
  NextDepartingTime: v.optional(v.number()),
});

export const orchestratorScheduleSnapshotSchema = v.object({
  SailingDay: v.string(),
  UpdatedAt: v.number(),
  scheduledDepartureBySegmentKey: v.record(
    v.string(),
    inferredScheduledSegmentSchema
  ),
  scheduledDeparturesByVesselAbbrev: v.record(
    v.string(),
    v.array(compactScheduledDepartureEventSchema)
  ),
});

export type CompactScheduledDepartureEvent = Infer<
  typeof compactScheduledDepartureEventSchema
>;

export type OrchestratorScheduleSnapshot = Infer<
  typeof orchestratorScheduleSnapshotSchema
>;

/**
 * One WSF batch plus identity rows after adapter conversion, before sequential
 * writes in `updateVesselOrchestrator`.
 */
export type VesselOrchestratorTickSnapshot = {
  convexLocations: ReadonlyArray<ConvexVesselLocation>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
};
