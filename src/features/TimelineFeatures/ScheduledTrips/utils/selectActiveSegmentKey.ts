/**
 * Active segment key selection for the ScheduledTrips page.
 * Chooses a single active scheduled segment key per vessel (held → exact → provisional).
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { Segment } from "../../TimelineFeatures/Timeline/types";

// ============================================================================
// Types (internal)
// ============================================================================

/** Result when an active segment is selected: key plus journey/segment indices. */
type ActiveSegmentResult = {
  activeKey: string;
  activeJourneyIndex: number | null;
  activeSegmentIndex: number | null;
};

type KeyToPosition = Map<
  string,
  { journeyIndex: number; segmentIndex: number }
>;

// ============================================================================
// Public API
// ============================================================================

/**
 * Selects the active scheduled segment key for a vessel on this terminal page,
 * and resolves its position in the vessel's sorted journeys.
 *
 * Selection priority:
 * 1. displayTrip.Key (held/current trip identity) when present
 * 2. Exact match using VesselLocation terminals + ScheduledDeparture
 * 3. Provisional inference (AtDock, missing ScheduledDeparture): next scheduled
 *    segment departing from this page's terminal
 *
 * @param params.terminalAbbrev - Page departure terminal
 * @param params.flatSegments - Flattened segments for this vessel's journeys (in order)
 * @param params.keyToPosition - Map from segment Key to journey/segment indices for position lookup
 * @param params.vesselLocation - Resolved vessel location (synced or live)
 * @param params.displayTrip - Held/active trip from hold-window logic
 * @param params.nowMs - Current time for provisional inference
 * @param params.provisionalDepartBufferMs - Buffer for provisional next-segment selection
 * @returns ActiveSegmentResult when an active segment is selected, null otherwise
 */
export const selectActiveSegmentKeyForVessel = (params: {
  terminalAbbrev: string;
  flatSegments: Segment[];
  keyToPosition: KeyToPosition;
  vesselLocation: VesselLocation | undefined;
  displayTrip: VesselTrip | undefined;
  nowMs: number;
  provisionalDepartBufferMs: number;
}): ActiveSegmentResult | null => {
  const {
    terminalAbbrev,
    flatSegments,
    keyToPosition,
    vesselLocation,
    displayTrip,
    nowMs,
    provisionalDepartBufferMs,
  } = params;

  const displayTripKey = displayTrip?.Key;
  if (displayTripKey) {
    const pos = keyToPosition.get(displayTripKey);
    return {
      activeKey: displayTripKey,
      activeJourneyIndex: pos?.journeyIndex ?? null,
      activeSegmentIndex: pos?.segmentIndex ?? null,
    };
  }

  if (!vesselLocation) return null;
  if (vesselLocation.DepartingTerminalAbbrev !== terminalAbbrev) return null;

  const scheduledDepartureMs = vesselLocation.ScheduledDeparture?.getTime();
  if (scheduledDepartureMs != null) {
    const exact = findExactScheduledSegmentKey({
      flatSegments,
      terminalAbbrev,
      arrivingTerminalAbbrev: vesselLocation.AtDock
        ? undefined
        : vesselLocation.ArrivingTerminalAbbrev,
      scheduledDepartureMs,
    });

    if (exact) {
      const pos = keyToPosition.get(exact);
      return {
        activeKey: exact,
        activeJourneyIndex: pos?.journeyIndex ?? null,
        activeSegmentIndex: pos?.segmentIndex ?? null,
      };
    }
  }

  if (!vesselLocation.AtDock) return null;

  const provisional = findNextScheduledSegmentKey({
    flatSegments,
    terminalAbbrev,
    nowMs,
    bufferMs: provisionalDepartBufferMs,
  });

  if (provisional == null) return null;

  const pos = keyToPosition.get(provisional);
  return {
    activeKey: provisional,
    activeJourneyIndex: pos?.journeyIndex ?? null,
    activeSegmentIndex: pos?.segmentIndex ?? null,
  };
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Finds an exact scheduled segment match by ScheduledDeparture time and terminals.
 *
 * @param params.flatSegments - Flattened segments for the vessel's journeys (in order)
 * @param params.terminalAbbrev - Page departure terminal
 * @param params.arrivingTerminalAbbrev - Optional; when at dock we match any arrival
 * @param params.scheduledDepartureMs - Scheduled departure time in ms
 * @returns The matching segment Key, or undefined
 */
const findExactScheduledSegmentKey = (params: {
  flatSegments: Segment[];
  terminalAbbrev: string;
  arrivingTerminalAbbrev: string | undefined;
  scheduledDepartureMs: number;
}): string | undefined => {
  const {
    flatSegments,
    terminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs,
  } = params;

  const match = flatSegments.find(
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
 * Used only during the post-arrival latency window when the new VesselTrip identity
 * isn't fully known yet.
 *
 * @param params.flatSegments - Flattened segments for the vessel's journeys (in order)
 * @param params.terminalAbbrev - Page departure terminal
 * @param params.nowMs - Current time for filtering past segments
 * @param params.bufferMs - Segments with departure before nowMs - bufferMs are excluded
 * @returns The Segment Key of the next scheduled segment, or undefined
 */
const findNextScheduledSegmentKey = (params: {
  flatSegments: Segment[];
  terminalAbbrev: string;
  nowMs: number;
  bufferMs: number;
}): string | undefined => {
  const { flatSegments, terminalAbbrev, nowMs, bufferMs } = params;

  const cutoffMs = nowMs - bufferMs;
  const candidates = flatSegments
    .filter((segment) => {
      if (segment.DepartingTerminalAbbrev !== terminalAbbrev) return false;
      const departingTimeMs = segment.DepartingTime.getTime();
      return departingTimeMs >= cutoffMs;
    })
    .map((segment) => ({
      key: segment.Key,
      departingTimeMs: segment.DepartingTime.getTime(),
    }));

  candidates.sort((a, b) => a.departingTimeMs - b.departingTimeMs);
  return candidates[0]?.key;
};
