/**
 * Utility for synthesizing raw ferry data into a unified TripSegment View Model.
 *
 * This version uses a self-resolving "pull-based" logic: each segment determines
 * its own status (past/ongoing/future) and phase (at-dock/at-sea/completed/pending)
 * by looking at the vesselTripMap (for actuals) and vesselLocation (for current activity).
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type {
  Segment,
  TimelineActivePhase,
  TimePoint,
  TripSegment,
} from "../../Timeline/types";

/** Max ms difference for matching ScheduledDeparture to segment.DepartingTime. */
const SCHEDULED_DEPARTURE_TOLERANCE_MS = 60_000;

/**
 * Synthesizes a list of raw segments into TripSegment View Models.
 *
 * @param params.segments - Raw scheduled segments
 * @param params.vesselTripMap - Map of segment Key to VesselTrip (actuals/predictions)
 * @param params.vesselLocation - Real-time vessel location
 * @param params.heldTrip - The trip currently being held (if any)
 * @returns Array of synthesized TripSegment objects
 */
export const synthesizeTripSegments = (params: {
  segments: Segment[];
  vesselTripMap: Map<string, VesselTrip>;
  vesselLocation: VesselLocation | undefined;
  heldTrip?: VesselTrip;
}): TripSegment[] => {
  const { segments, vesselTripMap, vesselLocation, heldTrip } = params;

  // 1. Identify the active segment key for the vessel.
  // Priority: Held Trip Key -> VesselLocation ScheduledDeparture (tolerant match) -> AtDock terminal fallback.
  const schedDepartureMs = vesselLocation?.ScheduledDeparture?.getTime();
  const activeKey =
    heldTrip?.Key ??
    (schedDepartureMs !== undefined
      ? segments.find((s) => {
          const segMs = s.DepartingTime.getTime();
          return (
            Math.abs(schedDepartureMs - segMs) <=
            SCHEDULED_DEPARTURE_TOLERANCE_MS
          );
        })?.Key
      : undefined) ??
    (vesselLocation?.AtDock && vesselLocation?.DepartingTerminalAbbrev
      ? segments.find(
          (s) =>
            s.DepartingTerminalAbbrev ===
              vesselLocation.DepartingTerminalAbbrev &&
            !vesselTripMap.get(s.Key)?.TripEnd
        )?.Key
      : undefined);

  const activePhase: TimelineActivePhase = vesselLocation
    ? vesselLocation.AtDock
      ? "AtDock"
      : "AtSea"
    : "Unknown";

  return segments.map((segment) => {
    const actualTrip = vesselTripMap.get(segment.Key);
    const isActive = !!activeKey && activeKey === segment.Key;
    const isHeld = isActive && !!heldTrip;

    // Self-resolving status:
    // - If we have a TripEnd in the map, it's definitely past.
    // - If it's the active key, it's ongoing.
    // - Otherwise, it's future.
    let status: "past" | "ongoing" | "future" = "future";
    if (actualTrip?.TripEnd) {
      status = "past";
    } else if (isActive) {
      status = "ongoing";
    }

    // Phase logic:
    // - Past status or held means completed.
    // - Ongoing status uses the activePhase.
    // - Future status is pending.
    let phase: "at-dock" | "at-sea" | "completed" | "pending" = "pending";
    if (status === "past" || isHeld) {
      phase = "completed";
    } else if (status === "ongoing") {
      // Refinement: If status is ongoing but we are AtSea, the indicator should be in the at-sea segment.
      // If status is ongoing but we are AtDock, the indicator should be in the at-dock segment.
      phase = activePhase === "AtSea" ? "at-sea" : "at-dock";
    }

    // 1. ArriveCurr TimePoint (Arrival at origin terminal)
    const arriveCurr: TimePoint = {
      scheduled: segment.SchedArriveCurr ?? segment.DepartingTime,
      actual: actualTrip?.TripStart ?? undefined,
      estimated: undefined,
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

    // Refinement: If status is ongoing but we are AtDock and have already arrived
    // (TripStart exists), but haven't left yet (LeftDock is missing), the indicator
    // should be in the at-dock segment.
    // If status is ongoing but we are AtSea, the indicator should be in the at-sea segment.
    // The current phase logic handles this via `activePhase`.
    const isArrivedAtDock = !!actualTrip?.TripStart;
    const isLeftDock = !!actualTrip?.LeftDock;

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
      isArrived: isArrivedAtDock,
      isLeft: isLeftDock,
    };
  });
};
