/**
 * Convex boundary adapters for vessel-trip tick processing.
 *
 * These helpers close over `ActionCtx` and internal queries while leaving trip
 * lifecycle rules in `convex/domain/vesselTrips`.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { resolveEffectiveDockedLocation } from "domain/vesselTrips/continuity/resolveEffectiveDockedLocation";
import type { ProcessVesselTripsDeps } from "domain/vesselTrips/processTick/processVesselTrips";
import { buildCompletedTrip } from "domain/vesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTrip } from "domain/vesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselTrips/tripLifecycle/detectTripEvents";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { EffectiveTripIdentity } from "shared/effectiveTripIdentity";

/**
 * Look up normalized scheduled boundary context and enrich schedule-derived
 * fields.
 *
 * Uses `eventsScheduled` via internal query (same source as timeline schedule
 * segments). Subscriber reads that join `scheduledTrips` for UI live in
 * `functions/vesselTrips/queries.getActiveTripsWithScheduledTrip`.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from baseTripFromLocation (has `ScheduleKey` when derivable)
 * @param existingTrip - Previous trip (for field reuse), undefined for first trip
 * @returns Trip enriched with schedule-derived fields if lookup succeeds
 */
export const appendFinalSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ConvexVesselTrip> => {
  const segmentKey = baseTrip.ScheduleKey;
  if (!segmentKey) {
    return baseTrip;
  }

  const carriedSchedule =
    existingTrip?.ScheduleKey === segmentKey
      ? {
          NextScheduleKey:
            baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
          NextScheduledDeparture:
            baseTrip.NextScheduledDeparture ??
            existingTrip.NextScheduledDeparture,
        }
      : undefined;

  if (carriedSchedule) {
    return {
      ...baseTrip,
      ...carriedSchedule,
    };
  }

  const scheduledSegment = await getScheduledSegmentByKey(ctx, segmentKey);

  return {
    ...baseTrip,
    ScheduleKey: scheduledSegment?.Key ?? baseTrip.ScheduleKey,
    NextScheduleKey: scheduledSegment?.NextKey ?? baseTrip.NextScheduleKey,
    NextScheduledDeparture:
      scheduledSegment?.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};

/**
 * Emit a warning when docked identity resolution changes the live feed or looks
 * suspicious (rollover / live conflict).
 *
 * @param args - Resolution inputs and effective location
 */
const logDockedIdentityResolution = ({
  location,
  existingTrip,
  stableDockedIdentity,
  scheduledSegmentKey,
  effectiveIdentity,
  effectiveLocation,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  stableDockedIdentity: boolean;
  scheduledSegmentKey: string | undefined;
  effectiveIdentity: EffectiveTripIdentity;
  effectiveLocation: ConvexVesselLocation;
}) => {
  const changedFromExisting =
    existingTrip?.ScheduleKey !== effectiveLocation.ScheduleKey ||
    existingTrip?.ScheduledDeparture !== effectiveLocation.ScheduledDeparture ||
    existingTrip?.ArrivingTerminalAbbrev !==
      effectiveLocation.ArrivingTerminalAbbrev;
  const changedFromLive =
    location.ScheduleKey !== effectiveLocation.ScheduleKey ||
    location.ScheduledDeparture !== effectiveLocation.ScheduledDeparture ||
    location.ArrivingTerminalAbbrev !==
      effectiveLocation.ArrivingTerminalAbbrev;
  const suspiciousState =
    effectiveIdentity.source === "rollover_schedule" ||
    effectiveIdentity.conflictsLiveFeed;

  if (!changedFromExisting && !changedFromLive && !suspiciousState) {
    return;
  }

  console.warn(
    `[VesselTrips][DockedIdentity] ${JSON.stringify({
      vesselAbbrev: location.VesselAbbrev,
      at: new Date(location.TimeStamp).toISOString(),
      stableDockedIdentity,
      effectiveIdentitySource: effectiveIdentity.source,
      conflictsLiveFeed: effectiveIdentity.conflictsLiveFeed,
      scheduledSegmentKey,
      changedFromExisting,
      changedFromLive,
    })}`
  );
};

/**
 * Resolve the effective location that downstream trip building should use.
 *
 * @param ctx - Convex action context for schedule lookups
 * @param location - Latest vessel location for this vessel
 * @param existingTrip - Active trip row when known
 * @returns Location with effective schedule identity applied when applicable
 */
const resolveEffectiveLocation = async (
  ctx: ActionCtx,
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ConvexVesselLocation> => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const result = await resolveEffectiveDockedLocation(
    createScheduledSegmentLookup(ctx),
    location,
    existingTrip
  );

  logDockedIdentityResolution({
    location,
    existingTrip,
    stableDockedIdentity: result.stableDockedIdentity,
    scheduledSegmentKey: result.scheduledResolution?.segment.Key,
    effectiveIdentity: result.effectiveIdentity,
    effectiveLocation: result.effectiveLocation,
  });

  return result.effectiveLocation;
};

/**
 * Create the `eventsScheduled` lookup contract consumed by continuity logic.
 *
 * @param ctx - Convex action context
 * @returns Lookup functions backed by internal queries
 */
const createScheduledSegmentLookup = (ctx: ActionCtx) => ({
  getScheduledDepartureSegmentBySegmentKey: (segmentKey: string) =>
    getScheduledSegmentByKey(ctx, segmentKey),
  getNextDepartureSegmentAfterDeparture: (args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    previousScheduledDeparture: number;
  }) =>
    ctx.runQuery(
      internal.functions.eventsScheduled.queries
        .getNextDepartureSegmentAfterDeparture,
      args
    ),
});

/**
 * Load one scheduled departure segment by key from `eventsScheduled`.
 *
 * @param ctx - Convex action context
 * @param segmentKey - Schedule segment key
 * @returns Matching scheduled segment or null
 */
const getScheduledSegmentByKey = (ctx: ActionCtx, segmentKey: string) =>
  ctx.runQuery(
    internal.functions.eventsScheduled.queries
      .getScheduledDepartureSegmentBySegmentKey,
    { segmentKey }
  );

/**
 * Default production dependency bag for `processVesselTripsWithDeps`.
 */
export const DEFAULT_PROCESS_VESSEL_TRIPS_DEPS: ProcessVesselTripsDeps = {
  buildCompletedTrip,
  buildTrip,
  detectTripEvents,
  buildTripAdapters: {
    resolveEffectiveLocation,
    appendFinalSchedule,
  },
};
