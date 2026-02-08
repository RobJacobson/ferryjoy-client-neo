/**
 * ScheduledTrips page-level display state computation.
 *
 * This module converts raw scheduled journeys for a terminal into deterministic
 * display state per journey card.
 *
 * Design goals:
 * - One active journey per vessel on the page (never multiple indicators).
 * - Segment statuses are monotonic once an active segment is known:
 *   Completed → InProgress → Pending by segment index.
 * - Preserve the 30s "hold" UX behavior by prioritizing `displayTrip.Key`.
 * - Handle the post-arrival latency window where the *next* VesselTrip may not yet have
 *   `ScheduledDeparture`, `ArrivingTerminalAbbrev`, or `Key` by selecting a provisional
 *   next scheduled segment from the scheduled data.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type {
  TimelineActivePhase,
  TimelineSegmentStatus,
} from "../../TimelineFeatures/Timeline/types";
import type { ScheduledTripJourney } from "../types";
import { selectActiveSegmentKeyForVessel } from "./selectActiveSegmentKey";

// ============================================================================
// Types
// ============================================================================

/** Re-export for consumers that import from this module. */
export type { ScheduledTripJourney } from "../types";

/**
 * Timeline state passed to ScheduledTripTimeline (activeKey, activePhase, statusByKey).
 * PredictionTrip derived from prevActualTrip (vesselTripMap.get(segment.PrevKey)) when index === 0.
 */
export type ScheduledTripTimelineState = {
  activeKey: string | null;
  activePhase: TimelineActivePhase;
  statusByKey: Map<string, TimelineSegmentStatus>;
};

export type ScheduledTripCardDisplayState = {
  /**
   * Vessel abbrev for looking up location and display trip from maps context.
   */
  vesselAbbrev: string;
  /**
   * Journey-level monotonic ordering for a vessel across the page.
   * - journeys before active: Completed
   * - active journey: InProgress
   * - journeys after active: Pending
   * - undefined when we cannot safely pick an active journey
   */
  journeyStatus?: "Pending" | "InProgress" | "Completed";
  timeline: ScheduledTripTimelineState;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Computes card display state for all journeys on a terminal page.
 *
 * Important behavioral rules:
 * - The page can contain multiple journeys for the same vessel; only one can be active.
 * - `displayTrip.Key` (held trip) always wins when present for that vessel.
 * - When a vessel is at dock at the page terminal but `ScheduledDeparture` is missing
 *   (known backend latency window for the newly-started trip), we select the *next*
 *   scheduled segment deterministically.
 *
 * @param params.terminalAbbrev - Page departure terminal (used for active-segment selection)
 * @param params.journeys - All scheduled journeys for the page (may include multiple per vessel)
 * @param params.vesselLocationByAbbrev - Resolved vessel location per vessel (synced or live)
 * @param params.displayTripByAbbrev - Held/active trip per vessel from hold-window logic
 * @param params.vesselTripMap - Unified map of trip Key to VesselTrip
 * @param params.provisionalDepartBufferMs - Buffer for provisional departure inference (default 5 min)
 * @returns Map of journey id to card display state
 */
export const computeCardDisplayStateForPage = (params: {
  terminalAbbrev: string;
  journeys: ScheduledTripJourney[];
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  displayTripByAbbrev: Map<string, VesselTrip>;
  vesselTripMap: Map<string, VesselTrip>;
  /**
   * Buffer used by provisional inference so we don't miss a departure that is
   * very near "now" (e.g., a few seconds after the scheduled time).
   */
  provisionalDepartBufferMs?: number;
}): Map<string, ScheduledTripCardDisplayState> => {
  const {
    journeys,
    vesselLocationByAbbrev,
    displayTripByAbbrev,
    vesselTripMap,
    provisionalDepartBufferMs = 5 * 60 * 1000,
  } = params;

  const grouped = groupJourneysByVessel(journeys);
  const displayStateEntries = Array.from(grouped.entries()).flatMap(
    ([vesselAbbrev, vesselJourneysUnsorted]) => {
      const vesselJourneys = [...vesselJourneysUnsorted].sort(
        (a, b) => a.departureTime - b.departureTime
      );
      return Array.from(
        computeCardDisplayStateForVessel({
          vesselAbbrev,
          vesselJourneys,
          terminalAbbrev: params.terminalAbbrev,
          vesselLocationByAbbrev,
          displayTripByAbbrev,
          vesselTripMap,
          provisionalDepartBufferMs,
        }).entries()
      );
    }
  );

  return new Map(displayStateEntries);
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Computes card display state for a single vessel's journeys (one active per vessel).
 *
 * @param params.vesselAbbrev - Vessel abbreviation for this group
 * @param params.vesselJourneys - This vessel's journeys sorted by departure time
 * @param params.terminalAbbrev - Page departure terminal for active-segment selection
 * @param params.vesselLocationByAbbrev - Resolved location per vessel
 * @param params.displayTripByAbbrev - Held/active trip per vessel
 * @param params.vesselTripMap - Unified map of segment Key to VesselTrip
 * @param params.provisionalDepartBufferMs - Buffer for provisional next-segment inference
 * @returns Map of journey id to ScheduledTripCardDisplayState for this vessel
 */
const computeCardDisplayStateForVessel = (params: {
  vesselAbbrev: string;
  vesselJourneys: ScheduledTripJourney[];
  terminalAbbrev: string;
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  displayTripByAbbrev: Map<string, VesselTrip>;
  vesselTripMap: Map<string, VesselTrip>;
  provisionalDepartBufferMs: number;
}): Map<string, ScheduledTripCardDisplayState> => {
  const {
    vesselAbbrev,
    vesselJourneys,
    terminalAbbrev,
    vesselLocationByAbbrev,
    displayTripByAbbrev,
    vesselTripMap,
    provisionalDepartBufferMs,
  } = params;

  const vesselLocation = vesselLocationByAbbrev.get(vesselAbbrev);
  const displayTrip = displayTripByAbbrev.get(vesselAbbrev);
  const nowMs = vesselLocation?.TimeStamp.getTime() ?? Date.now();

  const keyToPosition = keyToPositionForVessel(vesselJourneys);
  const flatSegments = vesselJourneys.flatMap((j) => j.segments);
  const active = selectActiveSegmentKeyForVessel({
    terminalAbbrev,
    flatSegments,
    keyToPosition,
    vesselLocation,
    displayTrip,
    nowMs,
    provisionalDepartBufferMs,
  });

  const activeKey = active?.activeKey ?? null;
  const activeJourneyIndex = active?.activeJourneyIndex ?? null;
  const activeSegmentIndex = active?.activeSegmentIndex ?? null;

  const getJourneyStatus = (
    idx: number
  ): "Pending" | "InProgress" | "Completed" | undefined =>
    activeJourneyIndex != null
      ? idx < activeJourneyIndex
        ? ("Completed" as const)
        : idx === activeJourneyIndex
          ? ("InProgress" as const)
          : ("Pending" as const)
      : undefined;

  const entries = vesselJourneys.map((journey, idx) => {
    const journeyStatus = getJourneyStatus(idx);
    const segmentIndexForTimeline =
      idx === activeJourneyIndex ? activeSegmentIndex : undefined;
    const timeline = computeJourneyTimelineState(
      journey,
      journeyStatus,
      activeKey,
      segmentIndexForTimeline,
      vesselLocation,
      vesselLocation?.TimeStamp.getTime() ?? Date.now(),
      vesselTripMap
    );
    return [journey.id, { vesselAbbrev, journeyStatus, timeline }] as [
      string,
      ScheduledTripCardDisplayState,
    ];
  });
  return new Map(entries);
};

/**
 * Builds a map from segment Key to journey/segment indices for a vessel's
 * sorted journeys. Used only for one-active-per-vessel display state (caller
 * passes result into selectActiveSegmentKeyForVessel for position lookup).
 *
 * @param vesselJourneys - This vessel's journeys sorted by departure time
 * @returns Map of segment Key to { journeyIndex, segmentIndex }
 */
const keyToPositionForVessel = (
  vesselJourneys: ScheduledTripJourney[]
): Map<string, { journeyIndex: number; segmentIndex: number }> => {
  const entries = vesselJourneys.flatMap((journey, ji) =>
    journey.segments.map(
      (segment, si) =>
        [segment.Key, { journeyIndex: ji, segmentIndex: si }] as const
    )
  );
  return new Map(entries);
};

/**
 * Groups journeys by vessel abbrev for one-active-per-vessel display state.
 * Internal only; used by computeCardDisplayStateForPage.
 *
 * @param journeys - All scheduled journeys for the page
 * @returns Map of vessel abbrev to that vessel's journeys (unsorted)
 */
const groupJourneysByVessel = (
  journeys: ScheduledTripJourney[]
): Map<string, ScheduledTripJourney[]> => {
  const grouped = journeys.reduce<Record<string, ScheduledTripJourney[]>>(
    (acc, j) => {
      acc[j.vesselAbbrev] ??= [];
      acc[j.vesselAbbrev].push(j);
      return acc;
    },
    {}
  );
  return new Map(Object.entries(grouped));
};

/**
 * Builds statusByKey when no active segment is known. Uses schedule bounds and
 * TripEnd to derive Completed vs Pending per segment.
 *
 * @param params.journey - The journey to compute
 * @param params.nowMs - Current time for fallback status
 * @param params.tripsByKey - Unified map of segment Key to VesselTrip
 * @returns Map of segment Key to TimelineSegmentStatus
 */
const buildStatusByKeyWhenNoActiveSegment = (params: {
  journey: ScheduledTripJourney;
  nowMs: number;
  tripsByKey: Map<string, VesselTrip>;
}): Map<string, TimelineSegmentStatus> => {
  const firstStartMs = params.journey.segments[0]?.DepartingTime.getTime() ?? 0;
  const lastEndMs =
    params.journey.segments
      .map(
        (s) =>
          s.SchedArriveNext?.getTime() ??
          s.ArrivingTime?.getTime() ??
          s.NextDepartingTime?.getTime() ??
          s.DepartingTime.getTime()
      )
      .reduce((max, v) => Math.max(max, v), 0) ?? 0;
  const defaultStatus: TimelineSegmentStatus =
    params.nowMs < firstStartMs
      ? "Pending"
      : params.nowMs > lastEndMs
        ? "Completed"
        : "Pending";
  return new Map(
    params.journey.segments.map((segment) => {
      const actualTrip = params.tripsByKey.get(segment.Key);
      const segmentStatus: TimelineSegmentStatus = actualTrip?.TripEnd
        ? "Completed"
        : defaultStatus;
      return [segment.Key, segmentStatus] as const;
    })
  );
};

/**
 * Computes per-segment statuses and active phase for a single journey.
 *
 * @param journey - The journey to compute
 * @param journeyStatus - Page-level status for this journey (Completed/InProgress/Pending or undefined)
 * @param activeKey - Selected active segment key for this vessel
 * @param activeSegmentIndex - Pre-resolved segment index when this journey is active (null/undefined when not active)
 * @param vesselLocation - Resolved vessel location (synced or live)
 * @param nowMs - Current time for phase and fallback status
 * @param tripsByKey - Unified map of segment Key to VesselTrip
 * @returns Timeline state for the journey
 */
const computeJourneyTimelineState = (
  journey: ScheduledTripJourney,
  journeyStatus: "Pending" | "InProgress" | "Completed" | undefined,
  activeKey: string | null,
  activeSegmentIndex: number | null | undefined,
  vesselLocation: VesselLocation | undefined,
  nowMs: number,
  tripsByKey: Map<string, VesselTrip>
): ScheduledTripTimelineState => {
  // Non-active journey: all segments get the same status (Completed or Pending).
  if (journeyStatus && journeyStatus !== "InProgress") {
    const statusByKey = new Map(
      journey.segments.map((s) => [s.Key, journeyStatus] as const)
    );
    return {
      activeKey: null,
      activePhase: "Unknown",
      statusByKey,
    };
  }

  // Active journey: use pre-resolved segment index from selector (index 0 is valid; null/undefined = none).
  const hasActive = activeSegmentIndex != null;

  const statusByKey = hasActive
    ? (() => {
        const segIdx = activeSegmentIndex as number;
        return new Map(
          journey.segments.map((segment, idx) => [
            segment.Key,
            (idx < segIdx
              ? "Completed"
              : idx === segIdx
                ? "InProgress"
                : "Pending") as TimelineSegmentStatus,
          ])
        );
      })()
    : buildStatusByKeyWhenNoActiveSegment({ journey, nowMs, tripsByKey });

  const activePhase: TimelineActivePhase =
    hasActive && vesselLocation
      ? vesselLocation.AtDock
        ? "AtDock"
        : "AtSea"
      : "Unknown";

  return {
    activeKey: hasActive ? activeKey : null,
    activePhase,
    statusByKey,
  };
};
