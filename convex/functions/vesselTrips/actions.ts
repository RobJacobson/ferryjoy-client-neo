/**
 * Convex action-context adapters and default-wired `processVesselTrips` entrypoint.
 *
 * Schedule lookups use `internal.functions.eventsScheduled` queries; trip
 * lifecycle rules live under `domain/vesselTrips`.
 */

import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { resolveDockedScheduledSegment } from "domain/vesselTrips/continuity/resolveDockedScheduledSegment";
import { resolveEffectiveDockedLocation } from "domain/vesselTrips/continuity/resolveEffectiveDockedLocation";
import {
  type ProcessVesselTripsDeps,
  type ProcessVesselTripsOptions,
  processVesselTripsWithDeps,
} from "domain/vesselTrips/processTick/processVesselTrips";
import { buildCompletedTrip } from "domain/vesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTrip } from "domain/vesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselTrips/tripLifecycle/detectTripEvents";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type {
  ConvexVesselTrip,
  TickActiveTrip,
} from "functions/vesselTrips/schemas";
import type { EffectiveTripIdentity } from "shared/effectiveTripIdentity";

const summarizeLocationIdentity = (
  location: Pick<
    ConvexVesselLocation,
    | "AtDock"
    | "LeftDock"
    | "DepartingTerminalAbbrev"
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
    | "Speed"
    | "DepartingDistance"
    | "ArrivingDistance"
  >
) => ({
  atDock: location.AtDock,
  leftDock: location.LeftDock,
  departingTerminalAbbrev: location.DepartingTerminalAbbrev,
  arrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  scheduledDeparture: location.ScheduledDeparture,
  scheduleKey: location.ScheduleKey,
  speed: location.Speed,
  departingDistance: location.DepartingDistance,
  arrivingDistance: location.ArrivingDistance,
});

const summarizeTripIdentity = (trip: ConvexVesselTrip | undefined) =>
  trip
    ? {
        atDock: trip.AtDock,
        leftDock: trip.LeftDock,
        departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
        arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
        scheduledDeparture: trip.ScheduledDeparture,
        scheduleKey: trip.ScheduleKey,
        nextScheduleKey: trip.NextScheduleKey,
        nextScheduledDeparture: trip.NextScheduledDeparture,
      }
    : null;

const logDockedIdentityResolution = ({
  location,
  existingTrip,
  stableDockedIdentity,
  scheduledResolution,
  effectiveIdentity,
  effectiveLocation,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  stableDockedIdentity: boolean;
  scheduledResolution: Awaited<
    ReturnType<typeof resolveDockedScheduledSegment>
  > | null;
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
      timestamp: new Date(location.TimeStamp).toISOString(),
      stableDockedIdentity,
      effectiveIdentitySource: effectiveIdentity.source,
      conflictsLiveFeed: effectiveIdentity.conflictsLiveFeed,
      live: summarizeLocationIdentity(location),
      existingTrip: summarizeTripIdentity(existingTrip),
      scheduledResolution: scheduledResolution
        ? {
            source: scheduledResolution.source,
            segment: {
              key: scheduledResolution.segment.Key,
              scheduledDeparture: scheduledResolution.segment.DepartingTime,
              arrivingTerminalAbbrev:
                scheduledResolution.segment.ArrivingTerminalAbbrev,
              nextKey: scheduledResolution.segment.NextKey,
              nextScheduledDeparture:
                scheduledResolution.segment.NextDepartingTime,
            },
          }
        : null,
      effectiveLocation: summarizeLocationIdentity(effectiveLocation),
    })}`
  );
};

/**
 * Look up normalized scheduled boundary context and enrich schedule-derived fields.
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
  const segmentKey = baseTrip.ScheduleKey ?? null;
  if (!segmentKey) {
    return baseTrip;
  }

  if (existingTrip?.ScheduleKey === segmentKey) {
    return {
      ...baseTrip,
      ScheduleKey: baseTrip.ScheduleKey ?? existingTrip.ScheduleKey,
      NextScheduleKey: baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  const scheduledSegment = await ctx.runQuery(
    internal.functions.eventsScheduled.queries
      .getScheduledDepartureSegmentBySegmentKey,
    { segmentKey }
  );

  return {
    ...baseTrip,
    ScheduleKey: scheduledSegment?.Key ?? baseTrip.ScheduleKey,
    NextScheduleKey: scheduledSegment?.NextKey ?? baseTrip.NextScheduleKey,
    NextScheduledDeparture:
      scheduledSegment?.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};

/**
 * Resolve the effective location that downstream trip building should use.
 *
 * @param ctx - Convex action context for schedule lookups
 * @param location - Latest vessel location for this vessel
 * @param existingTrip - Active trip row when known
 * @returns Location with effective schedule identity applied when applicable
 */
export const resolveEffectiveLocation = async (
  ctx: ActionCtx,
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ConvexVesselLocation> => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const result = await resolveEffectiveDockedLocation(
    {
      getScheduledDepartureSegmentBySegmentKey: (segmentKey) =>
        ctx.runQuery(
          internal.functions.eventsScheduled.queries
            .getScheduledDepartureSegmentBySegmentKey,
          { segmentKey }
        ),
      getNextDepartureSegmentAfterDeparture: (args) =>
        ctx.runQuery(
          internal.functions.eventsScheduled.queries
            .getNextDepartureSegmentAfterDeparture,
          args
        ),
    },
    location,
    existingTrip
  );

  logDockedIdentityResolution({
    location,
    existingTrip,
    stableDockedIdentity: result.stableDockedIdentity,
    scheduledResolution: result.scheduledResolution,
    effectiveIdentity: result.effectiveIdentity,
    effectiveLocation: result.effectiveLocation,
  });

  return result.effectiveLocation;
};

const DEFAULT_PROCESS_VESSEL_TRIPS_DEPS: ProcessVesselTripsDeps = {
  buildCompletedTrip,
  buildTrip,
  detectTripEvents,
  buildTripAdapters: {
    resolveEffectiveLocation,
    appendFinalSchedule,
  },
  loadActiveTrips: async (ctx) =>
    ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips),
};

export { processVesselTripsWithDeps } from "domain/vesselTrips/processTick/processVesselTrips";
export type { VesselTripsTickResult } from "domain/vesselTrips/processTick/tickEnvelope";
export type { TickEventWrites } from "domain/vesselTrips/processTick/tickEventWrites";
export type { ProcessVesselTripsDeps, ProcessVesselTripsOptions };

/**
 * Process vessel trips for one orchestrator tick.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to process after orchestrator conversion
 * @param tickStartedAt - Tick timestamp owned by VesselOrchestrator
 * @param activeTrips - When **defined** (including `[]`), skips
 *   `getActiveTrips` and uses that snapshot
 * @param options - Optional; `shouldRunPredictionFallback` defaults from tick time
 * @returns Lifecycle result plus tick event writes for `applyTickEventWrites`
 */
export const processVesselTrips = async (
  ctx: ActionCtx,
  locations: ConvexVesselLocation[],
  tickStartedAt: number,
  activeTrips?: ReadonlyArray<TickActiveTrip>,
  options?: ProcessVesselTripsOptions
) =>
  processVesselTripsWithDeps(
    ctx,
    locations,
    tickStartedAt,
    DEFAULT_PROCESS_VESSEL_TRIPS_DEPS,
    activeTrips,
    options
  );
