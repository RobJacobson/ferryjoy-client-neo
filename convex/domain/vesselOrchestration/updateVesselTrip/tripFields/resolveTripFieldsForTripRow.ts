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

type ResolveTripFieldsForTripRowInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: ScheduleDbAccess;
  buildTrip: (
    resolvedCurrentTripFields: ResolvedCurrentTripFields
  ) => ConvexVesselTrip;
};

type ResolvedTripFields = {
  resolvedCurrentTripFields: ResolvedCurrentTripFields;
  inferredNext?: {
    NextScheduleKey?: string;
    NextScheduledDeparture?: number;
  };
};

/**
 * Resolves trip fields, emits inference diagnostics, and attaches next-leg fields.
 *
 * @param input - Location, prior trip, schedule tables, and trip builder callback
 * @returns Built trip row with resolved current and next schedule fields
 */
export const resolveTripFieldsForTripRow = async ({
  location,
  existingTrip,
  scheduleAccess,
  buildTrip,
}: ResolveTripFieldsForTripRowInput): Promise<ConvexVesselTrip> => {
  const { resolvedCurrentTripFields, inferredNext } =
    await resolveCurrentTripFields({
      location,
      existingTrip,
      scheduleAccess,
    });

  return attachNextScheduledTripFields({
    baseTrip: buildTrip(resolvedCurrentTripFields),
    existingTrip,
    inferredNext,
  });
};

/**
 * Resolves current-trip fields from WSF, schedule evidence, or fallback logic.
 *
 * @param input - Location, prior trip, and schedule lookup tables
 * @returns Resolved current-trip fields with data-source metadata
 */
const resolveCurrentTripFields = async ({
  location,
  existingTrip,
  scheduleAccess,
}: Omit<
  ResolveTripFieldsForTripRowInput,
  "buildTrip"
>): Promise<ResolvedTripFields> => {
  if (hasWsfTripFields(location)) {
    return { resolvedCurrentTripFields: getTripFieldsFromWsf(location) };
  }

  const carriedArrivingTerminalAbbrev =
    location.ArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;
  const carriedScheduledDeparture =
    location.ScheduledDeparture ?? existingTrip?.ScheduledDeparture;
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
    location.ArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;
  const fallbackScheduledDeparture =
    location.ScheduledDeparture ?? existingTrip?.ScheduledDeparture;
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

/**
 * Attaches next scheduled segment fields while preserving continuity when possible.
 *
 * @param args - Built trip row, prior trip row, and schedule lookup tables
 * @returns Trip row with next schedule key/departure fields populated or cleared
 */
const attachNextScheduledTripFields = async ({
  baseTrip,
  existingTrip,
  inferredNext,
}: {
  baseTrip: ConvexVesselTrip;
  existingTrip: ConvexVesselTrip | undefined;
  inferredNext:
    | {
        NextScheduleKey?: string;
        NextScheduledDeparture?: number;
      }
    | undefined;
}): Promise<ConvexVesselTrip> => {
  const segmentKey = baseTrip.ScheduleKey;
  if (!segmentKey) {
    return baseTrip;
  }

  if (inferredNext) {
    return {
      ...baseTrip,
      NextScheduleKey: inferredNext.NextScheduleKey,
      NextScheduledDeparture: inferredNext.NextScheduledDeparture,
    };
  }

  if (existingTrip?.ScheduleKey === segmentKey) {
    return {
      ...baseTrip,
      NextScheduleKey: baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  return {
    ...baseTrip,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
  };
};
