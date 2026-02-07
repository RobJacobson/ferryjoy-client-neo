/**
 * ScheduledTrips data-flow pipeline: schedule is primary; overlay (completed/active trips) decorates.
 * Pipeline 1: join schedule with overlay by segment Key → one SegmentTuple per segment.
 * Page display state: choose one active per vessel + segment statuses + inbound prediction wiring.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { ScheduledTripJourney, SegmentTuple } from "../types";
import type { PageMaps } from "./buildPageDataMaps";
import { computeCardDisplayStateForPage } from "./computePageDisplayState";

// ============================================================================
// Types
// ============================================================================

/** Result of runScheduledTripsPipeline; rendering uses tuples + display state. */
export type ScheduledTripsPipelineResult = {
  /**
   * Segment tuples grouped by journey id, in the same order as `journey.segments`.
   * Schedule is the canonical list; overlay trips are attached by segment Key.
   */
  segmentTuplesByJourneyId: Map<string, SegmentTuple[]>;
  /**
   * Page-level deterministic display state per journey id.
   * Contains one-active-per-vessel selection, per-segment statusByKey, and inbound prediction wiring.
   */
  displayStateByJourneyId: ReturnType<typeof computeCardDisplayStateForPage>;
};

// ============================================================================
// Runner: tuples + page display state
// ============================================================================

/**
 * Runs the ScheduledTrips pipeline: join schedule with overlay by Key (reduce),
 * then compute page-level display state. Schedule is primary; when maps are empty,
 * renders basic schedule (no actuals/predictions).
 *
 * @param journeys - Scheduled journeys (from getScheduledTripsForTerminal)
 * @param maps - Page maps (vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev); may be empty
 * @param terminalAbbrev - Page departure terminal (for active-segment selection)
 * @returns segmentTuplesByJourneyId + displayStateByJourneyId
 */
export const runScheduledTripsPipeline = (
  journeys: ScheduledTripJourney[],
  maps: PageMaps | null,
  terminalAbbrev: string
): ScheduledTripsPipelineResult => {
  const vesselTripMap = maps?.vesselTripMap ?? new Map<string, VesselTrip>();
  const vesselLocationByAbbrev =
    maps?.vesselLocationByAbbrev ?? new Map<string, VesselLocation>();
  const displayTripByAbbrev =
    maps?.displayTripByAbbrev ?? new Map<string, VesselTrip>();

  const segmentTuplesByJourneyId = buildSegmentTuplesByJourneyId(
    journeys,
    vesselTripMap
  );

  const displayStateByJourneyId = computeCardDisplayStateForPage({
    terminalAbbrev,
    journeys,
    vesselLocationByAbbrev,
    displayTripByAbbrev,
    vesselTripMap,
  });

  return { segmentTuplesByJourneyId, displayStateByJourneyId };
};

// ============================================================================
// Pipeline 1: reduce — join schedule with overlay by Key (grouped by journey)
// ============================================================================

/**
 * Builds one tuple per scheduled segment with optional overlay trip (active wins over completed).
 * Schedule is the canonical list; overlay is attached by segment Key.
 *
 * @param journeys - Scheduled journeys (from schedule query)
 * @param vesselTripMap - Map of segment Key to VesselTrip (from completed + active + hold)
 * @returns Map of journey id to SegmentTuple[] in segment order
 */
const buildSegmentTuplesByJourneyId = (
  journeys: ScheduledTripJourney[],
  vesselTripMap: Map<string, VesselTrip>
): Map<string, SegmentTuple[]> =>
  new Map(
    journeys.map((journey) => [
      journey.id,
      journey.segments.map((segment, segmentIndex) => ({
        segment,
        actualTrip: vesselTripMap.get(segment.Key),
        journeyId: journey.id,
        vesselAbbrev: journey.vesselAbbrev,
        segmentIndex,
      })),
    ])
  );
