/**
 * Hook that fetches and resolves all data needed to render the ScheduledTrips list.
 * Schedule is primary; overlay (completed/active) is optional and does not block "ready".
 * Runs pipeline: join schedule + overlay by Key → card display state and leg props.
 */

import { api } from "convex/_generated/api";
import { toDomainScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import { useQuery } from "convex/react";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import type { ScheduledTripJourney } from "./types";
import { useScheduledTripsMaps } from "./useScheduledTripsMaps";
import { reconstructJourneys } from "./utils/reconstructJourneys";
import {
  runScheduledTripsPipeline,
  type SegmentLegProps,
} from "./utils/scheduledTripsPipeline";

type UseScheduledTripsPageDataParams = {
  terminalAbbrev: string;
  destinationAbbrev?: string;
};

type UseScheduledTripsPageDataResult = {
  status: "loading" | "empty" | "ready";
  journeys: ScheduledTripJourney[] | undefined;
  /** Per-journey leg props from pipeline; timeline uses these (no context lookup). */
  legPropsByJourneyId: Map<string, SegmentLegProps[]>;
};

/**
 * Fetches schedule first (primary), then overlay (completed/active). Runs pipeline to
 * produce card display state and leg props. Ready when schedule is loaded; overlay
 * is optional (basic schedule when missing).
 *
 * @param terminalAbbrev - Departure terminal to load schedule for (e.g. "P52")
 * @param destinationAbbrev - Optional destination terminal to filter trips
 * @returns Object with status ("loading" | "empty" | "ready"), journeys, legPropsByJourneyId
 */
export const useScheduledTripsPageData = ({
  terminalAbbrev,
  destinationAbbrev,
}: UseScheduledTripsPageDataParams): UseScheduledTripsPageDataResult => {
  const sailingDay = getSailingDay(new Date());

  const rawSchedule = useQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForTerminal,
    { terminalAbbrev, destinationAbbrev, sailingDay }
  );

  // Map to domain only when query has resolved; avoid treating loading as empty.
  const flatDomain = rawSchedule?.map(toDomainScheduledTrip) ?? [];

  // Client-side journey reconstruction (grouping and chain building).
  const journeys = reconstructJourneys(
    flatDomain,
    terminalAbbrev,
    destinationAbbrev
  );

  // Unique departing terminal abbrevs from flat segments (for completed-trip lookups).
  const departingTerminalAbbrevs = [
    ...new Set(flatDomain.map((s) => s.DepartingTerminalAbbrev)),
  ];

  const maps = useScheduledTripsMaps({ sailingDay, departingTerminalAbbrevs });

  const pipelineResult =
    journeys != null && journeys.length > 0
      ? runScheduledTripsPipeline(journeys, maps, terminalAbbrev)
      : { legPropsByJourneyId: new Map<string, SegmentLegProps[]>() };

  // Treat undefined query result as loading; only then distinguish empty vs ready.
  const status: UseScheduledTripsPageDataResult["status"] =
    rawSchedule === undefined
      ? "loading"
      : journeys.length === 0
        ? "empty"
        : "ready";

  return {
    status,
    journeys,
    legPropsByJourneyId: pipelineResult.legPropsByJourneyId,
  };
};
