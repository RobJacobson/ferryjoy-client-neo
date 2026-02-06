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
import type { TimelineActivePhase } from "../Timeline/resolveTimeline";
import type { TimelineSegmentStatus } from "../Timeline/types";
import type { Segment } from "./types";

// ============================================================================
// Types
// ============================================================================

export type ActiveConfidence = "Exact" | "Provisional" | "None";

export type ScheduledTripJourney = {
  id: string;
  vesselAbbrev: string;
  routeAbbrev: string;
  /** Departure time in epoch ms (from the scheduledTrips backend). */
  departureTime: number;
  segments: Segment[];
};

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
 * @param params - Inputs needed to resolve journey/timeline state
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
    terminalAbbrev,
    journeys,
    vesselLocationByAbbrev,
    displayTripByAbbrev,
    vesselTripMap,
    provisionalDepartBufferMs = 5 * 60 * 1000,
  } = params;

  // Group journeys by vessel so only one journey per vessel can be active.
  const journeysByVessel = new Map<string, ScheduledTripJourney[]>();
  for (const journey of journeys) {
    const list = journeysByVessel.get(journey.vesselAbbrev) ?? [];
    list.push(journey);
    journeysByVessel.set(journey.vesselAbbrev, list);
  }

  const resolutionByJourneyId = new Map<string, ScheduledTripCardResolution>();

  for (const [vesselAbbrev, vesselJourneysUnsorted] of journeysByVessel) {
    const vesselJourneys = [...vesselJourneysUnsorted].sort(
      (a, b) => a.departureTime - b.departureTime
    );

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

      resolutionByJourneyId.set(journey.id, {
        vesselLocation,
        displayTrip,
        vesselTripMap,
        journeyStatus,
        timeline,
      });
    }
  }

  return resolutionByJourneyId;
};

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Selects the active scheduled segment key for a vessel on this terminal page.
 *
 * Selection priority:
 * 1. `displayTrip.Key` (held/current trip identity) when present
 * 2. Exact match using `VesselLocation` terminals + `ScheduledDeparture`
 * 3. Provisional inference (AtDock, missing ScheduledDeparture): pick the next scheduled
 *    segment departing from this page's terminal.
 *
 * @param params - Inputs required for active selection
 * @returns Selected key (or null) and confidence
 */
const selectActiveSegmentKeyForVessel = (params: {
  terminalAbbrev: string;
  journeys: ScheduledTripJourney[];
  vesselLocation: VesselLocation | undefined;
  displayTrip: VesselTrip | undefined;
  nowMs: number;
  provisionalDepartBufferMs: number;
}): { activeKey: string | null; activeConfidence: ActiveConfidence } => {
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

/**
 * Finds an exact scheduled segment match by ScheduledDeparture time and terminals.
 *
 * @param params - Inputs for exact matching
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

  for (const journey of journeys) {
    for (const segment of journey.segments) {
      if (segment.DepartingTerminalAbbrev !== terminalAbbrev) continue;
      if (
        arrivingTerminalAbbrev != null &&
        segment.ArrivingTerminalAbbrev !== arrivingTerminalAbbrev
      ) {
        continue;
      }

      if (segment.DepartingTime.getTime() === scheduledDepartureMs) {
        return segment.Key;
      }
    }
  }

  return undefined;
};

/**
 * Finds the next scheduled segment departing from this terminal, using time ordering.
 *
 * This is used only during the post-arrival latency window when the new VesselTrip
 * identity isn't fully known yet.
 *
 * @param params - Inputs for deterministic next-selection
 * @returns The Segment Key of the next scheduled segment, or undefined
 */
const findNextScheduledSegmentKey = (params: {
  journeys: ScheduledTripJourney[];
  terminalAbbrev: string;
  nowMs: number;
  bufferMs: number;
}): string | undefined => {
  const { journeys, terminalAbbrev, nowMs, bufferMs } = params;

  const candidates: Array<{ key: string; departingTimeMs: number }> = [];

  for (const journey of journeys) {
    for (const segment of journey.segments) {
      if (segment.DepartingTerminalAbbrev !== terminalAbbrev) continue;
      const departingTimeMs = segment.DepartingTime.getTime();

      // Only consider segments that are "next" in time ordering.
      if (departingTimeMs < nowMs - bufferMs) continue;

      candidates.push({ key: segment.Key, departingTimeMs });
    }
  }

  candidates.sort((a, b) => a.departingTimeMs - b.departingTimeMs);
  return candidates[0]?.key;
};

/**
 * Resolve per-segment statuses and active phase for a single journey.
 *
 * @param params - Journey inputs and the vessel's page-level active selection
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
