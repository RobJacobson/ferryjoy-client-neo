/**
 * Utility for synthesizing raw ferry data into a unified TripSegment View Model.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type {
  Segment,
  TimelineActivePhase,
  TimePoint,
  TripSegment,
} from "../../Timeline/types";

/**
 * Synthesizes a list of raw segments into TripSegment View Models.
 *
 * @param params.segments - Raw scheduled segments
 * @param params.vesselTripMap - Map of segment Key to VesselTrip (actuals/predictions)
 * @param params.vesselLocation - Real-time vessel location
 * @param params.activeKey - The currently active segment key for the vessel
 * @param params.activePhase - The current phase (AtDock/AtSea) for the vessel
 * @param params.activeSegmentIndex - The index of the active segment within this journey
 * @param params.journeyStatus - The status of the entire journey (Completed/InProgress/Pending)
 * @returns Array of synthesized TripSegment objects
 */
export const synthesizeTripSegments = (params: {
  segments: Segment[];
  vesselTripMap: Map<string, VesselTrip>;
  vesselLocation: VesselLocation | undefined;
  activeKey: string | null;
  activePhase: TimelineActivePhase;
  activeSegmentIndex?: number;
  journeyStatus?: "Pending" | "InProgress" | "Completed";
}): TripSegment[] => {
  const {
    segments,
    vesselTripMap,
    vesselLocation,
    activeKey,
    activePhase,
    activeSegmentIndex,
    journeyStatus,
  } = params;

  return segments.map((segment, index) => {
    const actualTrip = vesselTripMap.get(segment.Key);

    const isActive = activeKey === segment.Key;
    const isHeld = isActive && !!actualTrip?.TripEnd;

    // Monotonic status logic:
    // 1. If journey is Completed, all segments are past.
    // 2. If journey is Pending, all segments are future.
    // 3. If journey is InProgress:
    //    - segments before activeSegmentIndex are past
    //    - segment at activeSegmentIndex is ongoing
    //    - segments after activeSegmentIndex are future
    let status: "past" | "ongoing" | "future" = "future";
    if (journeyStatus === "Completed") {
      status = "past";
    } else if (
      journeyStatus === "InProgress" &&
      activeSegmentIndex !== undefined
    ) {
      if (index < activeSegmentIndex) status = "past";
      else if (index === activeSegmentIndex) status = "ongoing";
      else status = "future";
    }

    // Phase logic:
    // 1. If status is past, phase is completed.
    // 2. If status is ongoing, phase is at-sea or at-dock based on activePhase.
    // 3. If status is future, phase is pending.
    // 4. Special case: isHeld means the segment is technically completed (at dock).
    let phase: "at-dock" | "at-sea" | "completed" | "pending" = "pending";
    if (status === "past" || isHeld) {
      phase = "completed";
    } else if (status === "ongoing") {
      phase = activePhase === "AtSea" ? "at-sea" : "at-dock";
    }

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
