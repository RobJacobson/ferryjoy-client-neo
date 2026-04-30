/**
 * Trip-field schedule resolution for one trip row.
 */

import {
  findNextDepartureEvent,
  inferScheduledSegmentFromDepartureEvent,
} from "domain/timelineRows/scheduledSegmentResolvers";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { UpdateVesselTripDbAccess } from "../types";
import { getTripFieldsFromWsf } from "./getTripFieldsFromWsf";
import { hasWsfTripFields } from "./hasWsfTripFields";
import type { ResolvedCurrentTripFields } from "./types";

type ResolveTripScheduleFieldsInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: UpdateVesselTripDbAccess;
  allowCarriedCurrentFields?: boolean;
};

export type ResolvedTripScheduleFields = {
  current: ResolvedCurrentTripFields;
  next?: {
    NextScheduleKey?: string;
    NextScheduledDeparture?: number;
  };
};

/**
 * Resolves current-trip fields from WSF, schedule evidence, or fallback logic.
 *
 * @param input - Location, prior trip, and schedule lookup tables
 * @returns Resolved current-trip and next-leg schedule facts
 */
export const resolveTripScheduleFields = async ({
  location,
  existingTrip,
  scheduleAccess,
  allowCarriedCurrentFields = true,
}: ResolveTripScheduleFieldsInput): Promise<ResolvedTripScheduleFields> => {
  if (hasWsfTripFields(location)) {
    return { current: getTripFieldsFromWsf(location) };
  }

  if (allowCarriedCurrentFields) {
    const carriedCurrent = resolveCarriedCurrentTripFields(
      location,
      existingTrip
    );
    if (
      carriedCurrent.ArrivingTerminalAbbrev !== undefined &&
      carriedCurrent.ScheduledDeparture !== undefined
    ) {
      return { current: carriedCurrent };
    }
  }

  const fromNextKey = await resolveFromNextScheduleKey({
    location,
    existingTrip,
    scheduleAccess,
  });
  if (fromNextKey) {
    return fromSegment(fromNextKey, "next_scheduled_trip");
  }

  const fromRollover = await resolveFromScheduleRollover({
    location,
    scheduleAccess,
  });
  if (fromRollover) {
    return fromSegment(fromRollover, "schedule_rollover");
  }

  console.warn("[TripFields] schedule inference unavailable", {
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    timeStamp: location.TimeStamp,
    existingScheduleKey: existingTrip?.ScheduleKey,
    existingNextScheduleKey: existingTrip?.NextScheduleKey,
  });
  return {
    current: resolveCarriedCurrentTripFields(
      location,
      allowCarriedCurrentFields ? existingTrip : undefined
    ),
  };
};

const resolveCarriedCurrentTripFields = (
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): ResolvedCurrentTripFields => {
  const arrivingTerminalAbbrev =
    existingTrip?.ArrivingTerminalAbbrev ?? location.ArrivingTerminalAbbrev;
  const scheduledDeparture =
    existingTrip?.ScheduledDeparture ?? location.ScheduledDeparture;
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs: scheduledDeparture,
  });

  return {
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    ScheduledDeparture: scheduledDeparture,
    ScheduleKey:
      location.ScheduleKey ?? existingTrip?.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay ?? existingTrip?.SailingDay,
    tripFieldDataSource: "inferred",
  };
};

const fromSegment = (
  segment: ConvexInferredScheduledSegment,
  method: ResolvedCurrentTripFields["tripFieldInferenceMethod"]
): ResolvedTripScheduleFields => ({
  current: {
    ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
    ScheduledDeparture: segment.DepartingTime,
    ScheduleKey: segment.Key,
    SailingDay: segment.SailingDay,
    tripFieldDataSource: "inferred",
    tripFieldInferenceMethod: method,
  },
  next: {
    NextScheduleKey: segment.NextKey,
    NextScheduledDeparture: segment.NextDepartingTime,
  },
});

/**
 * Primary schedule resolution path: trust the previous trip's next key when it
 * resolves to a departure from the current terminal.
 */
const resolveFromNextScheduleKey = async ({
  location,
  existingTrip,
  scheduleAccess,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: UpdateVesselTripDbAccess;
}): Promise<ConvexInferredScheduledSegment | null> => {
  const nextScheduleKey = existingTrip?.NextScheduleKey;
  if (!nextScheduleKey) {
    return null;
  }

  const segment =
    await scheduleAccess.getScheduledSegmentByScheduleKey(nextScheduleKey);
  if (
    segment?.DepartingTerminalAbbrev !== location.DepartingTerminalAbbrev
  ) {
    return null;
  }
  return segment;
};

/**
 * Fallback schedule resolution path: infer from current/next sailing-day rows.
 */
const resolveFromScheduleRollover = async ({
  location,
  scheduleAccess,
}: {
  location: ConvexVesselLocation;
  scheduleAccess: UpdateVesselTripDbAccess;
}): Promise<ConvexInferredScheduledSegment | null> => {
  const rollover = await scheduleAccess.getScheduleRolloverDockEvents({
    vesselAbbrev: location.VesselAbbrev,
    timestamp: location.TimeStamp,
  });
  const currentDayDeparture = findNextDepartureEvent(
    [...rollover.currentDayEvents],
    {
      terminalAbbrev: location.DepartingTerminalAbbrev,
      afterTime: location.TimeStamp,
    }
  );
  if (currentDayDeparture) {
    return inferScheduledSegmentFromDepartureEvent(
      currentDayDeparture,
      [...rollover.currentDayEvents]
    );
  }

  const nextDayDeparture = findNextDepartureEvent(
    [...rollover.nextDayEvents],
    {
      terminalAbbrev: location.DepartingTerminalAbbrev,
      afterTime: Number.NEGATIVE_INFINITY,
    }
  );
  if (!nextDayDeparture) {
    return null;
  }
  return inferScheduledSegmentFromDepartureEvent(
    nextDayDeparture,
    [...rollover.nextDayEvents]
  );
};
