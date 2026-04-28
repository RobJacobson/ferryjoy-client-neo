/**
 * Trip-field resolution and schedule attachment for one trip row.
 */

import { getSegmentKeyFromBoundaryKey } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ScheduleDbAccess } from "domain/vesselOrchestration/shared/scheduleAccess";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { addDaysToYyyyMmDd, getSailingDay } from "shared/time";
import { deriveTripIdentity } from "shared/tripIdentity";
import { getTripFieldsFromWsf } from "./getTripFieldsFromWsf";
import { hasWsfTripFields } from "./hasWsfTripFields";
import type { ResolvedCurrentTripFields } from "./types";

type ResolveTripScheduleFieldsInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: ScheduleDbAccess;
};

export type ResolvedTripScheduleFields = {
  resolvedCurrentTripFields: ResolvedCurrentTripFields;
  inferredNext?: {
    NextScheduleKey?: string;
    NextScheduledDeparture?: number;
  };
};

/**
 * Resolves current-trip fields from WSF, schedule evidence, or fallback logic.
 *
 * @param input - Location, prior trip, and schedule lookup tables
 * @returns Resolved current-trip fields with data-source metadata
 */
export const resolveTripScheduleFields = async ({
  location,
  existingTrip,
  scheduleAccess,
}: ResolveTripScheduleFieldsInput): Promise<ResolvedTripScheduleFields> => {
  if (hasWsfTripFields(location)) {
    return { resolvedCurrentTripFields: getTripFieldsFromWsf(location) };
  }

  const carriedArrivingTerminalAbbrev =
    existingTrip?.ArrivingTerminalAbbrev ?? location.ArrivingTerminalAbbrev;
  const carriedScheduledDeparture =
    existingTrip?.ScheduledDeparture ?? location.ScheduledDeparture;
  const carriedIdentity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: carriedArrivingTerminalAbbrev,
    scheduledDepartureMs: carriedScheduledDeparture,
  });

  // Skip schedule reads when we already have enough fields to derive identity.
  if (
    carriedArrivingTerminalAbbrev !== undefined &&
    carriedScheduledDeparture !== undefined
  ) {
    return {
      resolvedCurrentTripFields: {
        ArrivingTerminalAbbrev: carriedArrivingTerminalAbbrev,
        ScheduledDeparture: carriedScheduledDeparture,
        ScheduleKey:
          location.ScheduleKey ??
          existingTrip?.ScheduleKey ??
          carriedIdentity.ScheduleKey,
        SailingDay: carriedIdentity.SailingDay ?? existingTrip?.SailingDay,
        tripFieldDataSource: "inferred",
      },
    };
  }

  const scheduleMatch = await inferScheduleMatch({
    location,
    existingTrip,
    scheduleAccess,
  });

  if (scheduleMatch) {
    return {
      resolvedCurrentTripFields: {
        ArrivingTerminalAbbrev: scheduleMatch.ArrivingTerminalAbbrev,
        ScheduledDeparture: scheduleMatch.DepartingTime,
        ScheduleKey: scheduleMatch.Key,
        SailingDay: scheduleMatch.SailingDay,
        tripFieldDataSource: "inferred",
        tripFieldInferenceMethod: scheduleMatch.tripFieldInferenceMethod,
      },
      inferredNext: {
        NextScheduleKey: scheduleMatch.NextKey,
        NextScheduledDeparture: scheduleMatch.NextDepartingTime,
      },
    };
  }

  const fallbackArrivingTerminalAbbrev =
    existingTrip?.ArrivingTerminalAbbrev ?? location.ArrivingTerminalAbbrev;
  const fallbackScheduledDeparture =
    existingTrip?.ScheduledDeparture ?? location.ScheduledDeparture;
  const fallbackIdentity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: fallbackArrivingTerminalAbbrev,
    scheduledDepartureMs: fallbackScheduledDeparture,
  });
  console.warn("[TripFields] schedule inference unavailable", {
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    timeStamp: location.TimeStamp,
    existingScheduleKey: existingTrip?.ScheduleKey,
    existingNextScheduleKey: existingTrip?.NextScheduleKey,
  });
  return {
    resolvedCurrentTripFields: {
      ArrivingTerminalAbbrev: fallbackArrivingTerminalAbbrev,
      ScheduledDeparture: fallbackScheduledDeparture,
      ScheduleKey:
        location.ScheduleKey ??
        existingTrip?.ScheduleKey ??
        fallbackIdentity.ScheduleKey,
      SailingDay: fallbackIdentity.SailingDay ?? existingTrip?.SailingDay,
      tripFieldDataSource: "inferred",
    },
  };
};

/**
 * Resolves schedule evidence from next key or same-day/next-day departures.
 *
 * @param args - Location, prior trip, and schedule hooks
 * @returns Matching segment enriched with inference method, or `null`
 */
const inferScheduleMatch = async ({
  location,
  existingTrip,
  scheduleAccess,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: ScheduleDbAccess;
}) => {
  const nextScheduleKey = existingTrip?.NextScheduleKey;
  if (nextScheduleKey) {
    const nextDepartureRow =
      await scheduleAccess.getScheduledDepartureEvent(nextScheduleKey);
    const nextSegment = nextDepartureRow
      ? await inferSegmentFromDepartureRow(scheduleAccess, nextDepartureRow)
      : null;
    if (
      nextSegment &&
      nextSegment.DepartingTerminalAbbrev === location.DepartingTerminalAbbrev
    ) {
      return {
        ...nextSegment,
        tripFieldInferenceMethod: "next_scheduled_trip" as const,
      };
    }
  }

  const currentSailingDay = getSailingDay(new Date(location.TimeStamp));
  const sameDayEvents = await scheduleAccess.getScheduledDockEvents(
    location.VesselAbbrev,
    currentSailingDay
  );
  const sameDayDepartures = sortDepartureRows(sameDayEvents);
  const nextSameDayDeparture = findNextDepartureForTerminal(
    sameDayDepartures,
    location.DepartingTerminalAbbrev,
    location.TimeStamp
  );

  const nextDeparture =
    nextSameDayDeparture ??
    (await findNextDayDeparture({
      scheduleAccess,
      vesselAbbrev: location.VesselAbbrev,
      departingTerminalAbbrev: location.DepartingTerminalAbbrev,
      currentSailingDay,
    }));

  if (!nextDeparture) {
    return null;
  }

  const rolledSegment = await inferSegmentFromDepartureRow(
    scheduleAccess,
    nextDeparture
  );
  if (!rolledSegment) {
    return null;
  }

  return {
    ...rolledSegment,
    tripFieldInferenceMethod: "schedule_rollover" as const,
  };
};

/**
 * Finds the first valid same-terminal departure after a timestamp.
 *
 * @param departures - Candidate departure rows
 * @param departingTerminalAbbrev - Current departing terminal abbreviation
 * @param minDepartureMs - Minimum departure timestamp cutoff
 * @returns First matching row, if any
 */
const findNextDepartureForTerminal = (
  departures: ReadonlyArray<ConvexScheduledDockEvent>,
  departingTerminalAbbrev: string,
  minDepartureMs: number
) =>
  departures.find(
    (departure) =>
      departure.TerminalAbbrev === departingTerminalAbbrev &&
      departure.ScheduledDeparture > minDepartureMs
  );

/**
 * Loads next-day departures only when same-day departures do not provide one.
 *
 * @param args - Schedule hooks and vessel/day scope
 * @returns First matching departure from next day, or `undefined`
 */
const findNextDayDeparture = async ({
  scheduleAccess,
  vesselAbbrev,
  departingTerminalAbbrev,
  currentSailingDay,
}: {
  scheduleAccess: ScheduleDbAccess;
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  currentSailingDay: string;
}) => {
  const nextSailingDay = addDaysToYyyyMmDd(currentSailingDay, 1);
  const nextDayEvents = await scheduleAccess.getScheduledDockEvents(
    vesselAbbrev,
    nextSailingDay
  );
  const nextDayDepartures = sortDepartureRows(nextDayEvents);
  return nextDayDepartures.find(
    (departure) => departure.TerminalAbbrev === departingTerminalAbbrev
  );
};

/**
 * Builds one inferred segment from a scheduled departure row.
 *
 * @param scheduleAccess - Scheduled-event DB helper
 * @param departureRow - Scheduled departure dock row
 * @returns Inferred segment with optional next-leg continuity fields
 */
const inferSegmentFromDepartureRow = async (
  scheduleAccess: ScheduleDbAccess,
  departureRow: ConvexScheduledDockEvent
) => {
  const sameDayEvents = await scheduleAccess.getScheduledDockEvents(
    departureRow.VesselAbbrev,
    departureRow.SailingDay
  );
  const departures = sortDepartureRows(sameDayEvents);
  const departureIndex = departures.findIndex(
    (departure) => departure.Key === departureRow.Key
  );
  const nextDeparture =
    departureIndex >= 0 ? departures[departureIndex + 1] : undefined;

  return {
    Key: getSegmentKeyFromBoundaryKey(departureRow.Key),
    SailingDay: departureRow.SailingDay,
    DepartingTerminalAbbrev: departureRow.TerminalAbbrev,
    ArrivingTerminalAbbrev: departureRow.NextTerminalAbbrev,
    DepartingTime: departureRow.ScheduledDeparture,
    NextKey: nextDeparture
      ? getSegmentKeyFromBoundaryKey(nextDeparture.Key)
      : undefined,
    NextDepartingTime: nextDeparture?.ScheduledDeparture,
  };
};

/**
 * Filters and sorts scheduled events into departure rows.
 *
 * @param events - Scheduled dock events for one vessel/day scope
 * @returns Sorted departure-only rows
 */
const sortDepartureRows = (
  events: ReadonlyArray<ConvexScheduledDockEvent>
): ReadonlyArray<ConvexScheduledDockEvent> =>
  events
    .filter((event) => event.EventType === "dep-dock")
    .sort(
      (left, right) =>
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
    );
