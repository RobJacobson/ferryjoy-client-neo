/**
 * Utility for synthesizing raw ferry data into a unified TripSegment View Model.
 *
 * This version uses a self-resolving "pull-based" logic: each segment determines
 * its own status (past/ongoing/future) and phase (at-dock/at-sea/completed/pending)
 * by looking at the vesselTripByKeys (for actuals) and vesselLocation (for current activity).
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type {
  Segment,
  TimelineActivePhase,
  TimePoint,
  TripSegment,
} from "../../../shared/types";

/** Max ms difference for matching ScheduledDeparture to segment.DepartingTime. */
const SCHEDULED_DEPARTURE_TOLERANCE_MS = 60_000;

/**
 * Synthesizes a list of raw segments into TripSegment View Models.
 *
 * @param params.segments - Raw scheduled segments
 * @param params.vesselTripByKeys - Map of segment Key to VesselTrip (actuals/predictions)
 * @param params.vesselLocation - Real-time vessel location
 * @param params.heldTrip - The trip currently being held (if any)
 * @returns Array of synthesized TripSegment objects
 */
export const synthesizeTripSegments = (params: {
  segments: Segment[];
  vesselTripByKeys: Map<string, VesselTrip>;
  vesselLocation: VesselLocation | undefined;
  heldTrip?: VesselTrip;
}): TripSegment[] => {
  const { segments, vesselTripByKeys, vesselLocation, heldTrip } = params;

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
            !vesselTripByKeys.get(s.Key)?.TripEnd
        )?.Key
      : undefined);

  const activePhase: TimelineActivePhase = vesselLocation
    ? vesselLocation.AtDock
      ? "AtDock"
      : "AtSea"
    : "Unknown";

  return segments.map((segment) => {
    const actualTrip = vesselTripByKeys.get(segment.Key);
    const prevTrip = segment.PrevKey
      ? vesselTripByKeys.get(segment.PrevKey)
      : undefined;
    const isActive = !!activeKey && activeKey === segment.Key;
    const isHeld = isActive && !!heldTrip;

    // Self-resolving status:
    // - Active segment is always ongoing (so we never show "Arrived" on the bar while en route).
    // - If we have TripEnd and this segment is not active, it's past.
    // - Otherwise, it's future.
    let status: "past" | "ongoing" | "future" = "future";
    if (isActive) {
      status = "ongoing";
    } else if (actualTrip?.TripEnd) {
      status = "past";
    }

    // Phase logic:
    // - Past status means completed. Held + past also completed.
    // - Ongoing status always uses activePhase (at-sea vs at-dock) so we never show "Arrived" on
    //   the at-sea bar while the vessel is en route, even when the trip is held (displayData).
    // - Held + ongoing was incorrectly forcing phase to "completed", causing "Arrived" + "--".
    let phase: "at-dock" | "at-sea" | "completed" | "pending" = "pending";
    if (status === "past") {
      phase = "completed";
    } else if (isHeld && status !== "ongoing") {
      phase = "completed";
    } else if (status === "ongoing") {
      phase = activePhase === "AtSea" ? "at-sea" : "at-dock";
    }

    // Estimated arrival at this segment's origin: from this trip's actuals or from previous leg's predictions.
    const arriveCurrEstimated =
      status === "future" && prevTrip
        ? (vesselLocation?.Eta ??
          prevTrip.AtSeaArriveNext?.PredTime ??
          prevTrip.AtDockArriveNext?.PredTime)
        : undefined;

    // Estimated departure from this segment's origin: from this trip or from previous leg's "depart next" predictions.
    const leaveCurrEstimatedFromPrev =
      status === "future" && prevTrip
        ? (prevTrip.AtDockDepartNext?.PredTime ??
          prevTrip.AtSeaDepartNext?.PredTime)
        : undefined;

    // 1. ArriveCurr TimePoint (Arrival at origin terminal)
    const arriveCurr: TimePoint = {
      scheduled: segment.SchedArriveCurr ?? segment.DepartingTime,
      actual: actualTrip?.TripStart ?? undefined,
      estimated: arriveCurrEstimated,
    };

    // 2. LeaveCurr TimePoint (Departure from origin terminal)
    // Show depart estimate when at dock and we have a prediction, even if segment is held.
    // For future segments, use previous leg's AtDockDepartNext/AtSeaDepartNext.
    const leaveCurr: TimePoint = {
      scheduled: segment.DepartingTime,
      actual: actualTrip?.LeftDock ?? undefined,
      estimated:
        isActive && activePhase === "AtDock"
          ? actualTrip?.AtDockDepartCurr?.PredTime
          : leaveCurrEstimatedFromPrev,
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
      departingDistance:
        isActive && activePhase === "AtSea"
          ? vesselLocation?.DepartingDistance
          : undefined,
      arrivingDistance:
        isActive && activePhase === "AtSea"
          ? vesselLocation?.ArrivingDistance
          : undefined,
      isHeld,
      isArrived: isArrivedAtDock,
      isLeft: isLeftDock,
    };
  });
};
