/**
 * Active segment key selection for the ScheduledTrips page.
 * Chooses a single active scheduled segment key per vessel (held → exact → provisional).
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { ScheduledTripJourney } from "../types";
import type { ActiveConfidence } from "./resolveScheduledTripsPageResolution";

/** Result of active segment selection: key (or null) and confidence level. */
export type ActiveSelection = {
  activeKey: string | null;
  activeConfidence: ActiveConfidence;
};

/**
 * Finds an exact scheduled segment match by ScheduledDeparture time and terminals.
 *
 * @param params.journeys - All journeys for this vessel (sorted by departure)
 * @param params.terminalAbbrev - Page departure terminal
 * @param params.arrivingTerminalAbbrev - Optional; when at dock we match any arrival
 * @param params.scheduledDepartureMs - Scheduled departure time in ms
 * @returns The matching scheduled Segment Key, or undefined
 */
const findExactScheduledSegmentKey = (params: {
  journeys: ScheduledTripJourney[];
  terminalAbbrev: string;
  arrivingTerminalAbbrev: string | undefined;
  scheduledDepartureMs: number;
}): string | undefined => {
  const {
    journeys,
    terminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs,
  } = params;

  // Flatten journeys and segments to find the exact match.
  const match = journeys
    .flatMap((j) => j.segments)
    .find(
      (segment) =>
        segment.DepartingTerminalAbbrev === terminalAbbrev &&
        (arrivingTerminalAbbrev == null ||
          segment.ArrivingTerminalAbbrev === arrivingTerminalAbbrev) &&
        segment.DepartingTime.getTime() === scheduledDepartureMs
    );
  return match?.Key;
};

/**
 * Finds the next scheduled segment departing from this terminal, using time ordering.
 *
 * This is used only during the post-arrival latency window when the new VesselTrip
 * identity isn't fully known yet.
 *
 * @param params.journeys - All journeys for this vessel
 * @param params.terminalAbbrev - Page departure terminal
 * @param params.nowMs - Current time for filtering past segments
 * @param params.bufferMs - Segments with departure before nowMs - bufferMs are excluded
 * @returns The Segment Key of the next scheduled segment, or undefined
 */
const findNextScheduledSegmentKey = (params: {
  journeys: ScheduledTripJourney[];
  terminalAbbrev: string;
  nowMs: number;
  bufferMs: number;
}): string | undefined => {
  const { journeys, terminalAbbrev, nowMs, bufferMs } = params;

  // Filter segments by terminal and time.
  const cutoffMs = nowMs - bufferMs;
  const candidates = journeys.flatMap((journey) =>
    journey.segments.flatMap((segment) => {
      if (segment.DepartingTerminalAbbrev !== terminalAbbrev) return [];
      const departingTimeMs = segment.DepartingTime.getTime();
      if (departingTimeMs < cutoffMs) return [];
      return [{ key: segment.Key, departingTimeMs }];
    })
  );

  candidates.sort((a, b) => a.departingTimeMs - b.departingTimeMs);
  return candidates[0]?.key;
};

/**
 * Selects the active scheduled segment key for a vessel on this terminal page.
 *
 * Selection priority:
 * 1. `displayTrip.Key` (held/current trip identity) when present
 * 2. Exact match using `VesselLocation` terminals + `ScheduledDeparture`
 * 3. Provisional inference (AtDock, missing ScheduledDeparture): pick the next scheduled
 *    segment departing from this page's terminal.
 *
 * @param params.terminalAbbrev - Page departure terminal
 * @param params.journeys - All journeys for this vessel (sorted by departure)
 * @param params.vesselLocation - Resolved vessel location (synced or live)
 * @param params.displayTrip - Held/active trip from hold-window logic
 * @param params.nowMs - Current time for provisional inference
 * @param params.provisionalDepartBufferMs - Buffer for provisional next-segment selection
 * @returns Selected key (or null) and confidence
 */
export const selectActiveSegmentKeyForVessel = (params: {
  terminalAbbrev: string;
  journeys: ScheduledTripJourney[];
  vesselLocation: VesselLocation | undefined;
  displayTrip: VesselTrip | undefined;
  nowMs: number;
  provisionalDepartBufferMs: number;
}): ActiveSelection => {
  const {
    terminalAbbrev,
    journeys,
    vesselLocation,
    displayTrip,
    nowMs,
    provisionalDepartBufferMs,
  } = params;

  const displayTripKey = displayTrip?.Key;
  if (displayTripKey) {
    return { activeKey: displayTripKey, activeConfidence: "Exact" };
  }

  if (!vesselLocation) {
    return { activeKey: null, activeConfidence: "None" };
  }

  // Only attempt to select an active journey when the vessel is currently serving
  // this page's departing terminal.
  if (vesselLocation.DepartingTerminalAbbrev !== terminalAbbrev) {
    return { activeKey: null, activeConfidence: "None" };
  }

  const scheduledDepartureMs = vesselLocation.ScheduledDeparture?.getTime();
  if (scheduledDepartureMs != null) {
    const exact = findExactScheduledSegmentKey({
      journeys,
      terminalAbbrev,
      arrivingTerminalAbbrev: vesselLocation.AtDock
        ? undefined
        : vesselLocation.ArrivingTerminalAbbrev,
      scheduledDepartureMs,
    });

    if (exact) return { activeKey: exact, activeConfidence: "Exact" };
  }

  // Provisional selection: known latency window where the new trip has started in the
  // backend (DepartingTerminal switched), but ScheduledDeparture/ArrivingTerminal/Key
  // are not yet available. AtDock is required to avoid guessing while at sea.
  if (!vesselLocation.AtDock) {
    return { activeKey: null, activeConfidence: "None" };
  }

  const provisional = findNextScheduledSegmentKey({
    journeys,
    terminalAbbrev,
    nowMs,
    bufferMs: provisionalDepartBufferMs,
  });

  return provisional
    ? { activeKey: provisional, activeConfidence: "Provisional" }
    : { activeKey: null, activeConfidence: "None" };
};
