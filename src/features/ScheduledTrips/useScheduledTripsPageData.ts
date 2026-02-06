/**
 * Hook that fetches and resolves all data needed to render the ScheduledTrips list.
 * Returns status (loading/empty/ready), journeys, and card display state per journey.
 */

import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import type { ScheduledTripJourney } from "./types";
import { useScheduledTripsMaps } from "./useScheduledTripsMaps";
import type { PageMaps } from "./utils/buildPageDataMaps";
import {
  computeCardDisplayStateForPage,
  type ScheduledTripCardDisplayState,
} from "./utils/computePageDisplayState";
import { toSegment } from "./utils/conversion";
import { getDepartingTerminalAbbrevs } from "./utils/segmentUtils";

type UseScheduledTripsPageDataParams = {
  terminalAbbrev: string;
  destinationAbbrev?: string;
};

type UseScheduledTripsPageDataResult = {
  status: "loading" | "empty" | "ready";
  journeys: ScheduledTripJourney[] | undefined;
  cardDisplayStateByJourneyId: Map<string, ScheduledTripCardDisplayState>;
  /** Page maps (non-null when status is ready). */
  maps: PageMaps | null;
};

/**
 * Fetches scheduled trips, gets maps via useScheduledTripsMaps, and computes one
 * display state per journey card (one active per vessel). Use for the ScheduledTrips list page.
 *
 * @param params.terminalAbbrev - Departure terminal to load schedule for
 * @param params.destinationAbbrev - Optional destination filter
 * @returns status, journeys, and cardDisplayStateByJourneyId for rendering
 */
export const useScheduledTripsPageData = ({
  terminalAbbrev,
  destinationAbbrev,
}: UseScheduledTripsPageDataParams): UseScheduledTripsPageDataResult => {
  const sailingDay = getSailingDay(new Date());

  const trips = useQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForTerminal,
    {
      terminalAbbrev,
      destinationAbbrev,
      sailingDay,
    }
  );

  const journeys = trips
    ? trips.map((trip) => ({
        ...trip,
        segments: trip.segments.map(toSegment),
      }))
    : undefined;

  const departingTerminalAbbrevs =
    trips == null
      ? []
      : getDepartingTerminalAbbrevs(trips.flatMap((t) => t.segments));

  const maps = useScheduledTripsMaps({ sailingDay, departingTerminalAbbrevs });

  const cardDisplayStateByJourneyId =
    journeys != null && maps != null
      ? computeCardDisplayStateForPage({
          terminalAbbrev,
          journeys,
          vesselLocationByAbbrev: maps.vesselLocationByAbbrev,
          displayTripByAbbrev: maps.displayTripByAbbrev,
          vesselTripMap: maps.vesselTripMap,
        })
      : new Map<string, ScheduledTripCardDisplayState>();

  const status: UseScheduledTripsPageDataResult["status"] =
    trips === undefined
      ? "loading"
      : trips.length === 0
        ? "empty"
        : departingTerminalAbbrevs.length > 0 && maps === null
          ? "loading"
          : "ready";

  return {
    status,
    journeys,
    cardDisplayStateByJourneyId,
    maps,
  };
};
