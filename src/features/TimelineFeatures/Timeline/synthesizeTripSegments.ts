/**
 * Utility for synthesizing raw ferry data into a unified TripSegment View Model.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type {
  Segment,
  TimelineActivePhase,
  TimelineSegmentStatus,
  TimePoint,
  TripSegment,
} from "./types";

/**
 * Synthesizes a list of raw segments into TripSegment View Models.
 *
 * @param params.segments - Raw scheduled segments
 * @param params.vesselTripMap - Map of segment Key to VesselTrip (actuals/predictions)
 * @param params.vesselLocation - Real-time vessel location
 * @param params.activeKey - The currently active segment key for the vessel
 * @param params.activePhase - The current phase (AtDock/AtSea) for the vessel
 * @param params.statusByKey - Map of segment Key to status (Completed/InProgress/Pending)
 * @returns Array of synthesized TripSegment objects
 */
export const synthesizeTripSegments = (params: {
  segments: Segment[];
  vesselTripMap: Map<string, VesselTrip>;
  vesselLocation: VesselLocation | undefined;
  activeKey: string | null;
  activePhase: TimelineActivePhase;
  statusByKey: Map<string, TimelineSegmentStatus>;
}): TripSegment[] => {
  const {
    segments,
    vesselTripMap,
    vesselLocation,
    activeKey,
    activePhase,
    statusByKey,
  } = params;

  return segments.map((segment, _index) => {
    const actualTrip = vesselTripMap.get(segment.Key);
    const _prevActualTrip = segment.PrevKey
      ? vesselTripMap.get(segment.PrevKey)
      : undefined;

    const legStatus = statusByKey.get(segment.Key) ?? "Pending";
    const isActive = activeKey === segment.Key;
    const isHeld = isActive && !!actualTrip?.TripEnd;

    // 1. ArriveCurr TimePoint (Arrival at origin terminal)
    const arriveCurr: TimePoint = {
      scheduled: segment.SchedArriveCurr ?? segment.DepartingTime, // Fallback to departure if no arrival
      actual: actualTrip?.TripStart ?? undefined,
      estimated: undefined, // Currently not provided for origin arrival
    };

    // 2. LeaveCurr TimePoint (Departure from origin terminal)
    const leaveCurr: TimePoint = {
      scheduled: segment.DepartingTime,
      actual: actualTrip?.LeftDock ?? undefined,
      estimated:
        isActive && activePhase === "AtDock" && !isHeld
          ? actualTrip?.AtDockDepartCurr?.PredTime
          : undefined,
    };

    // 3. ArriveNext TimePoint (Arrival at destination terminal)
    const arriveNext: TimePoint = {
      scheduled:
        segment.SchedArriveNext ??
        segment.ArrivingTime ??
        segment.DepartingTime,
      actual: actualTrip?.TripEnd ?? undefined,
      estimated:
        (isActive && activePhase === "AtSea") || isHeld
          ? (vesselLocation?.Eta ??
            actualTrip?.AtSeaArriveNext?.PredTime ??
            actualTrip?.AtDockArriveNext?.PredTime)
          : undefined,
    };

    // Determine Status
    let status: "past" | "ongoing" | "future" = "future";
    if (legStatus === "Completed") status = "past";
    else if (legStatus === "InProgress") status = "ongoing";

    // Determine Phase
    let phase: "at-dock" | "at-sea" | "completed" | "pending" = "pending";
    if (legStatus === "Completed" || isHeld) {
      phase = "completed";
    } else if (isActive) {
      phase = activePhase === "AtSea" ? "at-sea" : "at-dock";
    }

    return {
      id: segment.Key,
      vesselAbbrev: segment.VesselAbbrev,
      vesselName: vesselLocation?.VesselName,
      currTerminal: {
        abbrev: segment.DepartingTerminalAbbrev,
      },
      nextTerminal: {
        abbrev: segment.ArrivingTerminalAbbrev,
      },
      arriveCurr,
      leaveCurr,
      arriveNext,
      status,
      phase,
      speed: vesselLocation?.Speed,
      isHeld,
    };
  });
};
