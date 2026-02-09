/**
 * ScheduledTrips data-flow pipeline: schedule is primary; overlay (completed/active trips) decorates.
 * Page display state: choose one active per vessel + segment statuses + inbound prediction wiring.
 * Rendering uses segments + vesselTripMap (PrevKey/NextKey lookups) instead of pre-joined tuples.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { ScheduledTripJourney } from "../types";
import type { PageMaps } from "./buildPageDataMaps";
import { computeCardDisplayStateForPage } from "./computePageDisplayState";

// ============================================================================
// Types
// ============================================================================

/** Result of runScheduledTripsPipeline; rendering uses segments + vesselTripMap + display state. */
export type ScheduledTripsPipelineResult = {
  /**
   * Map of segment Key to VesselTrip for O(1) lookup. Used with PrevKey/NextKey for prev/next trips.
   */
  vesselTripMap: Map<string, VesselTrip>;
  /**
   * Page-level deterministic display state per journey id.
   * Contains one-active-per-vessel selection, per-segment statusByKey, and inbound prediction wiring.
   */
  displayStateByJourneyId: ReturnType<typeof computeCardDisplayStateForPage>;
};

// ============================================================================
// Runner: vesselTripMap + page display state
// ============================================================================

/**
 * Runs the ScheduledTrips pipeline: compute page-level display state. Schedule is primary;
 * when maps are empty, renders basic schedule (no actuals/predictions). Rendering uses
 * segments + vesselTripMap with PrevKey/NextKey for prev/next trip lookups.
 *
 * @param journeys - Scheduled journeys (from getScheduledTripsForTerminal)
 * @param maps - Page maps (vesselTripMap, vesselLocationByAbbrev, displayTripByAbbrev); may be empty
 * @param terminalAbbrev - Page departure terminal (for active-segment selection)
 * @returns vesselTripMap + displayStateByJourneyId
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

  const displayStateByJourneyId = computeCardDisplayStateForPage({
    terminalAbbrev,
    journeys,
    vesselLocationByAbbrev,
    displayTripByAbbrev,
    vesselTripMap,
  });

  return { vesselTripMap, displayStateByJourneyId };
};
