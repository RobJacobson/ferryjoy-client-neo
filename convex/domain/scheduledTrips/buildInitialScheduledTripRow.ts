/**
 * Builds the initial `ConvexScheduledTrip` row after vessel/terminal identity
 * resolution and canonical key computation. Delegates prefetch policies to
 * {@link applyPrefetchSchedulePolicies}.
 */

import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import { applyPrefetchSchedulePolicies } from "./applyPrefetchSchedulePolicies";

/**
 * Scalar fields required to construct a storage row before classification.
 */
export type InitialScheduledTripRowInput = {
  Key: string;
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SailingNotes: string;
  Annotations: string[];
  RouteID: number;
  RouteAbbrev: string;
  SailingDay: string;
};

/**
 * Constructs the default pre-pipeline scheduled trip: `TripType` is `"direct"`
 * until {@link classifyDirectSegments} runs; prefetch policies (e.g. Route 9)
 * may set `SchedArriveCurr`.
 *
 * @param input - Resolved abbreviations, canonical key, and segment scalars
 * @returns Row ready for `runScheduleTransformPipeline`
 */
export const buildInitialScheduledTripRow = (
  input: InitialScheduledTripRowInput
): ConvexScheduledTrip => {
  const trip: ConvexScheduledTrip = {
    VesselAbbrev: input.VesselAbbrev,
    DepartingTerminalAbbrev: input.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: input.ArrivingTerminalAbbrev,
    DepartingTime: input.DepartingTime,
    ArrivingTime: input.ArrivingTime,
    SailingNotes: input.SailingNotes,
    Annotations: input.Annotations,
    RouteID: input.RouteID,
    RouteAbbrev: input.RouteAbbrev,
    Key: input.Key,
    SailingDay: input.SailingDay,
    TripType: "direct",
  };

  return applyPrefetchSchedulePolicies(trip);
};
