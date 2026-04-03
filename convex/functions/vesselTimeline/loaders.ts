/**
 * Convex-specific VesselTimeline loaders and schedule-backed identity helpers.
 *
 * This module owns database access and query-time orchestration for the public
 * VesselTimeline query. Pure row-building and view-model assembly stay in the
 * domain layer.
 */

import type { QueryCtx } from "_generated/server";
import type { ConvexActualBoundaryEvent } from "../eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { getSailingDay } from "../../shared/time";
import type { ConvexVesselTrip } from "../vesselTrips/schemas";

export type LoadedVesselTimelineViewModelInputs = {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
  location: ConvexVesselLocation | null;
  activeTrip: ConvexVesselTrip | null;
  inferredDockedTripKey: string | null;
  terminalTailTripKey: string | null;
};

/**
 * Loads all inputs needed to build the backend-owned VesselTimeline view
 * model.
 *
 * @param ctx - Convex query context
 * @param args - Vessel/day scope
 * @returns Loaded inputs ready for domain assembly
 */
export const loadVesselTimelineViewModelInputs = async (
  ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    SailingDay: string;
  }
): Promise<LoadedVesselTimelineViewModelInputs> => {
  const [
    scheduledDocs,
    actualDocs,
    predictedDocs,
    locationDoc,
    activeTripDoc,
  ] = await Promise.all([
    ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q.eq("VesselAbbrev", args.VesselAbbrev).eq("SailingDay", args.SailingDay)
      )
      .collect(),
    ctx.db
      .query("eventsActual")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q.eq("VesselAbbrev", args.VesselAbbrev).eq("SailingDay", args.SailingDay)
      )
      .collect(),
    ctx.db
      .query("eventsPredicted")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q.eq("VesselAbbrev", args.VesselAbbrev).eq("SailingDay", args.SailingDay)
      )
      .collect(),
    ctx.db
      .query("vesselLocations")
      .withIndex("by_vessel_abbrev", (q) => q.eq("VesselAbbrev", args.VesselAbbrev))
      .unique(),
    ctx.db
      .query("activeVesselTrips")
      .withIndex("by_vessel_abbrev", (q) => q.eq("VesselAbbrev", args.VesselAbbrev))
      .unique(),
  ]);

  const scheduledEvents = scheduledDocs.map(stripConvexMeta);
  const actualEvents = actualDocs.map(stripConvexMeta);
  const predictedEvents = predictedDocs.map(stripConvexMeta);
  const location = locationDoc ? stripConvexMeta(locationDoc) : null;
  const activeTrip = activeTripDoc ? stripConvexMeta(activeTripDoc) : null;
  const [terminalTailTripKey, inferredDockedTripKey] = await Promise.all([
    resolveTerminalTailTripKey(ctx, scheduledEvents),
    resolveInferredDockedTripKey(ctx, {
      VesselAbbrev: args.VesselAbbrev,
      location,
      activeTrip,
      scheduledEvents,
    }),
  ]);

  return {
    scheduledEvents,
    actualEvents,
    predictedEvents,
    location,
    activeTrip,
    inferredDockedTripKey,
    terminalTailTripKey,
  };
};

/**
 * Resolves the next-trip key for a terminal-tail arrival row.
 *
 * @param ctx - Convex query context
 * @param scheduledEvents - Scheduled boundary events for the visible slice
 * @returns Next-trip key for the terminal tail, or `null`
 */
const resolveTerminalTailTripKey = async (
  ctx: QueryCtx,
  scheduledEvents: Array<{
    Key: string;
    VesselAbbrev: string;
    TerminalAbbrev: string;
    EventType: "dep-dock" | "arv-dock";
    EventScheduledTime?: number;
    ScheduledDeparture: number;
  }>
) => {
  const sortedEvents = [...scheduledEvents].sort(sortScheduledBoundaryEvents);
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  if (!lastEvent || lastEvent.EventType !== "arv-dock") {
    return null;
  }

  const currentTrip = await getScheduledTripByKey(
    ctx,
    getTripKeyFromBoundaryKey(lastEvent.Key)
  );
  if (currentTrip?.NextKey) {
    return currentTrip.NextKey;
  }

  const nextTrip = await getNextScheduledTripForVesselAtTerminal(ctx, {
    vesselAbbrev: lastEvent.VesselAbbrev,
    departingTerminalAbbrev: lastEvent.TerminalAbbrev,
    arrivalTime: lastEvent.EventScheduledTime ?? lastEvent.ScheduledDeparture,
  });

  // If the trip table is missing a matching scheduledTrip row, fall back to
  // the arrival boundary's own trip key so the final dock stop still renders.
  return (
    nextTrip?.Key ?? currentTrip?.Key ?? getTripKeyFromBoundaryKey(lastEvent.Key)
  );
};

/**
 * Resolves the docked trip key when live state is docked but keyless.
 *
 * @param ctx - Convex query context
 * @param args - Live and active-trip context
 * @returns Deterministically inferred docked trip key, or `null`
 */
const resolveInferredDockedTripKey = async (
  ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    location: {
      AtDock: boolean;
      Key?: string;
      TimeStamp: number;
      DepartingTerminalAbbrev: string;
    } | null;
    activeTrip: Pick<ConvexVesselTrip, "Key" | "PrevScheduledDeparture"> | null;
    scheduledEvents: Array<{
      Key: string;
      TerminalAbbrev: string;
      EventType: "dep-dock" | "arv-dock";
      EventScheduledTime?: number;
      ScheduledDeparture: number;
    }>;
  }
) => {
  if (!args.location?.AtDock) {
    return null;
  }

  if (args.activeTrip?.Key || args.location.Key) {
    return null;
  }

  if (args.activeTrip?.PrevScheduledDeparture !== undefined) {
    const rolloverTrip =
      await getNextScheduledTripForVesselAtTerminalAfterDeparture(ctx, {
        vesselAbbrev: args.VesselAbbrev,
        departingTerminalAbbrev: args.location.DepartingTerminalAbbrev,
        previousScheduledDeparture: args.activeTrip.PrevScheduledDeparture,
      });

    if (rolloverTrip) {
      return rolloverTrip.Key;
    }
  }

  const nextTrip = await getNextScheduledTripForVesselAtTerminal(ctx, {
    vesselAbbrev: args.VesselAbbrev,
    departingTerminalAbbrev: args.location.DepartingTerminalAbbrev,
    arrivalTime: args.location.TimeStamp,
  });

  if (nextTrip) {
    return nextTrip.Key;
  }

  const lastScheduledEvent = [...args.scheduledEvents].sort(
    sortScheduledBoundaryEvents
  )[args.scheduledEvents.length - 1];

  if (
    lastScheduledEvent?.EventType === "arv-dock" &&
    lastScheduledEvent.TerminalAbbrev === args.location.DepartingTerminalAbbrev
  ) {
    return getTripKeyFromBoundaryKey(lastScheduledEvent.Key);
  }

  return null;
};

/**
 * Finds a scheduled trip by its stable trip key.
 *
 * @param ctx - Convex query context
 * @param tripKey - Stable scheduled trip key
 * @returns Matching scheduled trip, or `null`
 */
const getScheduledTripByKey = async (ctx: QueryCtx, tripKey: string) => {
  const doc = await ctx.db
    .query("scheduledTrips")
    .withIndex("by_key", (q) => q.eq("Key", tripKey))
    .first();

  return doc ? stripConvexMeta(doc) : null;
};

/**
 * Finds the first next direct scheduled trip at or after an arrival instant.
 *
 * @param ctx - Convex query context
 * @param args - Vessel, terminal, and arrival context
 * @returns Matching scheduled trip, or `null`
 */
const getNextScheduledTripForVesselAtTerminal = async (
  ctx: QueryCtx,
  args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    arrivalTime: number;
  }
) => {
  const currentSailingDay = getSailingDay(new Date(args.arrivalTime));
  const nextSailingDay = addDays(currentSailingDay, 1);
  const directTrips = (
    await Promise.all(
      [currentSailingDay, nextSailingDay].map((sailingDay) =>
        ctx.db
          .query("scheduledTrips")
          .withIndex("by_vessel_sailing_day_trip_type", (q) =>
            q
              .eq("VesselAbbrev", args.vesselAbbrev)
              .eq("SailingDay", sailingDay)
              .eq("TripType", "direct")
          )
          .collect()
      )
    )
  )
    .flat()
    .map(stripConvexMeta);

  return (
    directTrips
      .filter(
        (trip) =>
          trip.DepartingTerminalAbbrev === args.departingTerminalAbbrev &&
          trip.DepartingTime >= args.arrivalTime
      )
      .sort((left, right) => left.DepartingTime - right.DepartingTime)[0] ??
    null
  );
};

/**
 * Finds the next direct scheduled trip after a prior scheduled departure.
 *
 * @param ctx - Convex query context
 * @param args - Vessel, terminal, and prior scheduled departure
 * @returns Matching scheduled trip, or `null`
 */
const getNextScheduledTripForVesselAtTerminalAfterDeparture = async (
  ctx: QueryCtx,
  args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    previousScheduledDeparture: number;
  }
) => {
  const currentSailingDay = getSailingDay(
    new Date(args.previousScheduledDeparture)
  );
  const nextSailingDay = addDays(currentSailingDay, 1);
  const directTrips = (
    await Promise.all(
      [currentSailingDay, nextSailingDay].map((sailingDay) =>
        ctx.db
          .query("scheduledTrips")
          .withIndex("by_vessel_sailing_day_trip_type", (q) =>
            q
              .eq("VesselAbbrev", args.vesselAbbrev)
              .eq("SailingDay", sailingDay)
              .eq("TripType", "direct")
          )
          .collect()
      )
    )
  )
    .flat()
    .map(stripConvexMeta);

  return (
    directTrips
      .filter(
        (trip) =>
          trip.DepartingTerminalAbbrev === args.departingTerminalAbbrev &&
          trip.DepartingTime > args.previousScheduledDeparture
      )
      .sort((left, right) => left.DepartingTime - right.DepartingTime)[0] ??
    null
  );
};

/**
 * Extracts the trip key prefix from a boundary-event key.
 *
 * @param boundaryKey - Boundary-event key
 * @returns Stable trip key
 */
const getTripKeyFromBoundaryKey = (boundaryKey: string) =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

/**
 * Adds whole days to a sailing-day string.
 *
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @param days - Whole-day delta
 * @returns Shifted sailing day
 */
const addDays = (sailingDay: string, days: number) => {
  const [year, month, day] = sailingDay.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};

/**
 * Sorts scheduled boundary events into stable timeline order.
 *
 * @param left - Left scheduled event
 * @param right - Right scheduled event
 * @returns Stable sort comparison result
 */
const sortScheduledBoundaryEvents = (
  left: {
    ScheduledDeparture: number;
    EventType: "dep-dock" | "arv-dock";
    TerminalAbbrev: string;
  },
  right: {
    ScheduledDeparture: number;
    EventType: "dep-dock" | "arv-dock";
    TerminalAbbrev: string;
  }
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

/**
 * Returns the stable sort rank for one boundary-event type.
 *
 * @param eventType - Boundary-event type
 * @returns Sort rank
 */
const getEventTypeOrder = (eventType: "dep-dock" | "arv-dock") =>
  eventType === "dep-dock" ? 0 : 1;
