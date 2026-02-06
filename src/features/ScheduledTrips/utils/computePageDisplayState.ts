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
} from "../../Timeline/types";
import type { ScheduledTripJourney, Segment } from "../types";
import { selectActiveSegmentKeyForVessel } from "./selectActiveSegmentKey";

// ============================================================================
// Types
// ============================================================================

export type ActiveConfidence = "Exact" | "Provisional" | "None";

/** Re-export for consumers that import from this module. */
export type { ScheduledTripJourney } from "../types";

export type ScheduledTripTimelineState = {
  activeKey: string | null;
  activeConfidence: ActiveConfidence;
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
  /**
   * For future cards: the inbound trip whose NextKey matches the first segment.
   * Used for arrive-next and depart-next predictions on the first segment.
   */
  inboundTripForFirstSegment?: VesselTrip;
};

// ============================================================================
// Public API
// ============================================================================

/** Groups journeys by vessel abbrev for one-active-per-vessel display state. */
export const groupJourneysByVessel = (
  journeys: ScheduledTripJourney[]
): Partial<Record<string, ScheduledTripJourney[]>> =>
  journeys.reduce<Partial<Record<string, ScheduledTripJourney[]>>>(
    (acc, j) => ({
      ...acc,
      [j.vesselAbbrev]: [...(acc[j.vesselAbbrev] ?? []), j],
    }),
    {}
  );

/**
 * Computes card display state for a single vessel's journeys (one active per vessel).
 *
 * @param params - Vessel abbrev, sorted journeys, maps, and options
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

  const activeSelection = selectActiveSegmentKeyForVessel({
    terminalAbbrev,
    journeys: vesselJourneys,
    vesselLocation,
    displayTrip,
    nowMs,
    provisionalDepartBufferMs,
  });

  const activeJourneyIndex =
    activeSelection.activeKey != null
      ? vesselJourneys.findIndex((j) =>
          j.segments.some((s) => s.Key === activeSelection.activeKey)
        )
      : -1;

  const getJourneyStatus = (
    idx: number
  ): "Pending" | "InProgress" | "Completed" | undefined =>
    activeJourneyIndex >= 0
      ? idx < activeJourneyIndex
        ? ("Completed" as const)
        : idx === activeJourneyIndex
          ? ("InProgress" as const)
          : ("Pending" as const)
      : undefined;

  const entries = vesselJourneys.map((journey, idx) => {
    const journeyStatus = getJourneyStatus(idx);
    const timeline = computeJourneyTimelineState({
      journey,
      journeyStatus,
      activeKey: activeSelection.activeKey,
      activeConfidence: activeSelection.activeConfidence,
      vesselLocation,
      nowMs: vesselLocation?.TimeStamp.getTime() ?? Date.now(),
      tripsByKey: vesselTripMap,
    });
    return [
      journey.id,
      {
        vesselAbbrev,
        journeyStatus,
        timeline,
        inboundTripForFirstSegment: getInboundTripForFirstSegment(
          displayTrip,
          journey.segments[0]
        ),
      },
    ] as [string, ScheduledTripCardDisplayState];
  });
  return new Map(entries);
};

/**
 * Computes card display state for all journeys on a terminal page.
 *
 * Important behavioral rules:
 * - The page can contain multiple journeys for the same vessel; only one can be active.
 * - `displayTrip.Key` (held trip) always wins when present for that vessel.
 * - When a vessel is at dock at the page terminal but `ScheduledDeparture` is missing
 *   (known backend latency window for the newly-started trip), we select the *next*
 *   scheduled segment deterministically and mark it Provisional.
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
  const displayStateEntries = Object.entries(grouped)
    .filter((entry): entry is [string, ScheduledTripJourney[]] => !!entry[1])
    .flatMap(([vesselAbbrev, vesselJourneysUnsorted]) => {
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
    });

  return new Map(displayStateEntries);
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Returns the displayTrip when it predicts the first segment (NextKey match).
 * Used for arrive-next and depart-next predictions on future cards.
 *
 * @param displayTrip - Held/active trip for this vessel
 * @param firstSegment - First segment of the journey (may be undefined)
 * @returns displayTrip when ArrivingTerminal and NextKey match, else undefined
 */
const getInboundTripForFirstSegment = (
  displayTrip: VesselTrip | undefined,
  firstSegment: Segment | undefined
): VesselTrip | undefined =>
  firstSegment &&
  displayTrip &&
  displayTrip.ArrivingTerminalAbbrev === firstSegment.DepartingTerminalAbbrev &&
  displayTrip.ScheduledTrip?.NextKey === firstSegment.Key
    ? displayTrip
    : undefined;

/**
 * Builds statusByKey when no active segment is known. Uses schedule bounds and
 * TripEnd to derive Completed vs Pending per segment.
 *
 * @param params - Same as computeJourneyTimelineState
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
 * @param params.journey - The journey to compute
 * @param params.journeyStatus - Page-level status for this journey (Completed/InProgress/Pending or undefined)
 * @param params.activeKey - Selected active segment key for this vessel
 * @param params.activeConfidence - Confidence of the active selection (Exact/Provisional/None)
 * @param params.vesselLocation - Resolved vessel location (synced or live)
 * @param params.nowMs - Current time for phase and fallback status
 * @param params.tripsByKey - Unified map of segment Key to VesselTrip
 * @returns Timeline state for the journey
 */
const computeJourneyTimelineState = (params: {
  journey: ScheduledTripJourney;
  journeyStatus: "Pending" | "InProgress" | "Completed" | undefined;
  activeKey: string | null;
  activeConfidence: ActiveConfidence;
  vesselLocation: VesselLocation | undefined;
  nowMs: number;
  tripsByKey: Map<string, VesselTrip>;
}): ScheduledTripTimelineState => {
  const {
    journey,
    journeyStatus,
    activeKey,
    activeConfidence,
    vesselLocation,
  } = params;

  // If the page has determined this journey is not active, force all segments to match
  // the journey-level monotonic status.
  if (journeyStatus && journeyStatus !== "InProgress") {
    const statusByKey = new Map(
      journey.segments.map((s) => [s.Key, journeyStatus] as const)
    );
    return {
      activeKey: null,
      activeConfidence,
      activePhase: "Unknown",
      statusByKey,
    };
  }

  // Active journey: derive monotonic statuses by segment index.
  const activeIndex =
    activeKey != null
      ? journey.segments.findIndex((s) => s.Key === activeKey)
      : -1;

  const statusByKey =
    activeIndex >= 0
      ? new Map(
          journey.segments.map((segment, idx) => [
            segment.Key,
            (idx < activeIndex
              ? "Completed"
              : idx === activeIndex
                ? "InProgress"
                : "Pending") as TimelineSegmentStatus,
          ])
        )
      : buildStatusByKeyWhenNoActiveSegment(params);

  const activePhase: TimelineActivePhase =
    activeIndex >= 0 && vesselLocation
      ? vesselLocation.AtDock
        ? "AtDock"
        : "AtSea"
      : "Unknown";

  return {
    activeKey: activeIndex >= 0 ? activeKey : null,
    activeConfidence: activeIndex >= 0 ? activeConfidence : "None",
    activePhase,
    statusByKey,
  };
};
