/**
 * ScheduledTrips page-level resolver.
 *
 * This module converts the raw scheduled journeys for a terminal into a single,
 * deterministic render resolution per journey card.
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
import type { TimelineActivePhase } from "../../Timeline/resolveTimeline";
import type { TimelineSegmentStatus } from "../../Timeline/types";
import type { ScheduledTripJourney, Segment } from "../types";
import { selectActiveSegmentKeyForVessel } from "./selectActiveSegmentKey";

// ============================================================================
// Types
// ============================================================================

export type ActiveConfidence = "Exact" | "Provisional" | "None";

/** Re-export for consumers that import from this module. */
export type { ScheduledTripJourney } from "../types";

export type ScheduledTripTimelineResolution = {
  activeKey: string | null;
  activeConfidence: ActiveConfidence;
  activePhase: TimelineActivePhase;
  statusByKey: Map<string, TimelineSegmentStatus>;
};

export type ScheduledTripCardResolution = {
  vesselLocation?: VesselLocation;
  displayTrip?: VesselTrip;
  vesselTripMap: Map<string, VesselTrip>;
  /**
   * Journey-level monotonic ordering for a vessel across the page.
   * - journeys before active: Completed
   * - active journey: InProgress
   * - journeys after active: Pending
   * - undefined when we cannot safely pick an active journey
   */
  journeyStatus?: "Pending" | "InProgress" | "Completed";
  timeline: ScheduledTripTimelineResolution;
};

/** Minimal journey shape for single-journey resolution (e.g. standalone timeline). */
export type SingleJourneyForResolution = {
  id: string;
  vesselAbbrev: string;
  segments: Segment[];
  /** Optional; derived from segments[0] if omitted. */
  departureTime?: number;
  routeAbbrev?: string;
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Resolves scheduled journey cards for a terminal page.
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
 * @returns Map of journey id to card resolution
 */
/**
 * Groups journeys by vessel abbrev so only one journey per vessel can be active.
 * Uses Object.groupBy (ES2024).
 *
 * @param journeys - All scheduled journeys for the page
 * @returns Record of vessel abbrev to that vessel's journeys (unsorted)
 */
export const groupJourneysByVessel = (
  journeys: ScheduledTripJourney[]
): Partial<Record<string, ScheduledTripJourney[]>> =>
  Object.groupBy(journeys, (j) => j.vesselAbbrev);

/**
 * Resolves card resolutions for a single vessel's journeys (one active per vessel).
 *
 * @param params - Vessel abbrev, sorted journeys, maps, and options
 * @returns Map of journey id to ScheduledTripCardResolution for this vessel
 */
const resolveResolutionsForVessel = (params: {
  vesselAbbrev: string;
  vesselJourneys: ScheduledTripJourney[];
  terminalAbbrev: string;
  vesselLocationByAbbrev: Map<string, VesselLocation>;
  displayTripByAbbrev: Map<string, VesselTrip>;
  vesselTripMap: Map<string, VesselTrip>;
  provisionalDepartBufferMs: number;
}): Map<string, ScheduledTripCardResolution> => {
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

  const result = new Map<string, ScheduledTripCardResolution>();
  for (const [idx, journey] of vesselJourneys.entries()) {
    const journeyStatus =
      activeJourneyIndex >= 0
        ? idx < activeJourneyIndex
          ? "Completed"
          : idx === activeJourneyIndex
            ? "InProgress"
            : "Pending"
        : undefined;

    const timeline = resolveJourneyTimeline({
      journey,
      journeyStatus,
      activeKey: activeSelection.activeKey,
      activeConfidence: activeSelection.activeConfidence,
      vesselLocation,
      nowMs,
      tripsByKey: vesselTripMap,
    });

    result.set(journey.id, {
      vesselLocation,
      displayTrip,
      vesselTripMap,
      journeyStatus,
      timeline,
    });
  }
  return result;
};

/**
 * Resolves scheduled journey cards for a terminal page.
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
 * @returns Map of journey id to card resolution
 */
export const resolveScheduledTripsPageResolution = (params: {
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
}): Map<string, ScheduledTripCardResolution> => {
  const {
    journeys,
    vesselLocationByAbbrev,
    displayTripByAbbrev,
    vesselTripMap,
    provisionalDepartBufferMs = 5 * 60 * 1000,
  } = params;

  const grouped = groupJourneysByVessel(journeys);
  const resolutionEntries = Object.entries(grouped).flatMap(
    ([vesselAbbrev, vesselJourneysUnsorted]) => {
      if (!vesselJourneysUnsorted) return [];
      const vesselJourneys = [...vesselJourneysUnsorted].sort(
        (a, b) => a.departureTime - b.departureTime
      );
      return Array.from(
        resolveResolutionsForVessel({
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

  return new Map(resolutionEntries);
};

/**
 * Resolves timeline for a single journey (e.g. standalone ScheduledTripTimeline).
 * Uses the same logic as the page: selectActiveSegmentKeyForVessel then resolveJourneyTimeline.
 * Single journey is always treated as InProgress for status purposes.
 *
 * @param params.terminalAbbrev - Departure terminal for active-segment selection
 * @param params.journey - Single journey (minimal shape: id, vesselAbbrev, segments)
 * @param params.vesselLocation - Resolved vessel location (synced or live)
 * @param params.displayTrip - Held/active trip from hold-window logic
 * @param params.vesselTripMap - Unified map of trip Key to VesselTrip
 * @param params.provisionalDepartBufferMs - Buffer for provisional inference (default 5 min)
 * @returns Timeline resolution for the journey
 */
export const resolveSingleJourneyTimeline = (params: {
  terminalAbbrev: string;
  journey: SingleJourneyForResolution;
  vesselLocation: VesselLocation | undefined;
  displayTrip: VesselTrip | undefined;
  vesselTripMap: Map<string, VesselTrip>;
  provisionalDepartBufferMs?: number;
}): ScheduledTripTimelineResolution => {
  const {
    terminalAbbrev,
    journey: minimalJourney,
    vesselLocation,
    displayTrip,
    vesselTripMap,
    provisionalDepartBufferMs = 5 * 60 * 1000,
  } = params;

  const journey: ScheduledTripJourney = {
    id: minimalJourney.id,
    vesselAbbrev: minimalJourney.vesselAbbrev,
    routeAbbrev: minimalJourney.routeAbbrev ?? "",
    departureTime:
      minimalJourney.departureTime ??
      minimalJourney.segments[0]?.DepartingTime.getTime() ??
      0,
    segments: minimalJourney.segments,
  };

  const nowMs = vesselLocation?.TimeStamp.getTime() ?? Date.now();
  const activeSelection = selectActiveSegmentKeyForVessel({
    terminalAbbrev,
    journeys: [journey],
    vesselLocation,
    displayTrip,
    nowMs,
    provisionalDepartBufferMs,
  });

  return resolveJourneyTimeline({
    journey,
    journeyStatus: "InProgress",
    activeKey: activeSelection.activeKey,
    activeConfidence: activeSelection.activeConfidence,
    vesselLocation,
    nowMs,
    tripsByKey: vesselTripMap,
  });
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Resolve per-segment statuses and active phase for a single journey.
 *
 * @param params.journey - The journey to resolve
 * @param params.journeyStatus - Page-level status for this journey (Completed/InProgress/Pending or undefined)
 * @param params.activeKey - Selected active segment key for this vessel
 * @param params.activeConfidence - Confidence of the active selection (Exact/Provisional/None)
 * @param params.vesselLocation - Resolved vessel location (synced or live)
 * @param params.nowMs - Current time for phase and fallback status
 * @param params.tripsByKey - Unified map of segment Key to VesselTrip
 * @returns Timeline resolution for the journey
 */
const resolveJourneyTimeline = (params: {
  journey: ScheduledTripJourney;
  journeyStatus: "Pending" | "InProgress" | "Completed" | undefined;
  activeKey: string | null;
  activeConfidence: ActiveConfidence;
  vesselLocation: VesselLocation | undefined;
  nowMs: number;
  tripsByKey: Map<string, VesselTrip>;
}): ScheduledTripTimelineResolution => {
  const {
    journey,
    journeyStatus,
    activeKey,
    activeConfidence,
    vesselLocation,
  } = params;

  const statusByKey = new Map<string, TimelineSegmentStatus>();

  // If the page has determined this journey is not active, force all segments to match
  // the journey-level monotonic status.
  if (journeyStatus && journeyStatus !== "InProgress") {
    for (const segment of journey.segments) {
      statusByKey.set(segment.Key, journeyStatus);
    }

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

  if (activeIndex >= 0) {
    for (const [idx, segment] of journey.segments.entries()) {
      statusByKey.set(
        segment.Key,
        idx < activeIndex
          ? "Completed"
          : idx === activeIndex
            ? "InProgress"
            : "Pending"
      );
    }
  } else {
    // No safely known active segment.
    //
    // We intentionally avoid selecting a schedule-time "InProgress" segment (phantom
    // indicators are worse than none). However, we still want stable Completed vs Pending
    // styling so *past* journeys show as completed even when the vessel is not currently
    // serving this terminal.
    const firstStartMs = journey.segments[0]?.DepartingTime.getTime() ?? 0;
    const lastEndMs =
      journey.segments
        .map((s) => {
          return (
            s.SchedArriveNext?.getTime() ??
            s.ArrivingTime?.getTime() ??
            s.NextDepartingTime?.getTime() ??
            s.DepartingTime.getTime()
          );
        })
        .reduce((max, v) => Math.max(max, v), 0) ?? 0;

    const defaultStatus: TimelineSegmentStatus =
      params.nowMs < firstStartMs
        ? "Pending"
        : params.nowMs > lastEndMs
          ? "Completed"
          : "Pending";

    for (const segment of journey.segments) {
      const actualTrip = params.tripsByKey.get(segment.Key);

      // If we have a matching trip record with a TripEnd, we can confidently mark
      // this segment Completed. This fixes cases where the page cannot determine
      // a single active journey for the vessel (e.g. a missing/late Key), but we
      // still have authoritative completed trip data for past segments.
      const segmentStatus: TimelineSegmentStatus = actualTrip?.TripEnd
        ? "Completed"
        : defaultStatus;

      statusByKey.set(segment.Key, segmentStatus);
    }
  }

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
