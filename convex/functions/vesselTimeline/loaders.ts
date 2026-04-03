/**
 * Convex-specific VesselTimeline loaders and event-backed identity helpers.
 *
 * This module owns database access and query-time orchestration for the public
 * VesselTimeline query. Pure row-building and view-model assembly stay in the
 * domain layer.
 */

import type { QueryCtx } from "_generated/server";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { getSailingDay } from "../../shared/time";
import type { ConvexActualBoundaryEvent } from "../eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../eventsScheduled/schemas";
import {
  findDockedDepartureEvent,
  findNextDepartureAfterBoundaryEvent,
  findNextDepartureEvent,
  getSegmentKeyFromBoundaryKey,
  sortScheduledBoundaryEvents,
} from "../eventsScheduled/segmentResolvers";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";
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
  const [scheduledDocs, actualDocs, predictedDocs, locationDoc, activeTripDoc] =
    await Promise.all([
      loadScheduledBoundaryEventsForSailingDay(
        ctx,
        args.VesselAbbrev,
        args.SailingDay
      ),
      ctx.db
        .query("eventsActual")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", args.VesselAbbrev)
            .eq("SailingDay", args.SailingDay)
        )
        .collect(),
      ctx.db
        .query("eventsPredicted")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", args.VesselAbbrev)
            .eq("SailingDay", args.SailingDay)
        )
        .collect(),
      ctx.db
        .query("vesselLocations")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.VesselAbbrev)
        )
        .unique(),
      ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.VesselAbbrev)
        )
        .unique(),
    ]);

  const scheduledEvents = scheduledDocs.map(stripConvexMeta);
  const actualEvents = actualDocs.map(stripConvexMeta);
  const predictedEvents = predictedDocs.map(stripConvexMeta);
  const location = locationDoc ? stripConvexMeta(locationDoc) : null;
  const activeTrip = activeTripDoc ? stripConvexMeta(activeTripDoc) : null;

  // Most timeline work stays inside the requested sailing day. Adjacent days
  // are loaded lazily only for the two cases that need event-order continuity:
  // terminal-tail ownership and keyless docked-trip attachment.
  const loadScheduledLookupEvents = async (argsForLookup: {
    includePreviousDay?: boolean;
    includeNextDay?: boolean;
  }) =>
    await loadScheduledLookupEventsAroundSailingDay(ctx, {
      vesselAbbrev: args.VesselAbbrev,
      sailingDay: args.SailingDay,
      currentDayEvents: scheduledEvents,
      includePreviousDay: argsForLookup.includePreviousDay,
      includeNextDay: argsForLookup.includeNextDay,
    });
  const [terminalTailTripKey, inferredDockedTripKey] = await Promise.all([
    // These are independent read-time attachments over the same event slice, so
    // compute them together once the base tables are loaded.
    resolveTerminalTailTripKey({
      scheduledEvents,
      loadScheduledLookupEvents,
    }),
    resolveInferredDockedTripKey(ctx, {
      VesselAbbrev: args.VesselAbbrev,
      SailingDay: args.SailingDay,
      location,
      activeTrip,
      scheduledEvents,
      loadScheduledLookupEvents,
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
 * @param args.scheduledEvents - Scheduled boundary events for the visible slice
 * @param args.loadScheduledLookupEvents - Lazy adjacent-day event loader
 * @returns Next-trip key for the terminal tail, or `null`
 */
const resolveTerminalTailTripKey = async ({
  scheduledEvents,
  loadScheduledLookupEvents,
}: {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  loadScheduledLookupEvents: (args: {
    includePreviousDay?: boolean;
    includeNextDay?: boolean;
  }) => Promise<ConvexScheduledBoundaryEvent[]>;
}) => {
  const sortedEvents = [...scheduledEvents].sort(sortScheduledBoundaryEvents);
  const lastEvent = sortedEvents[sortedEvents.length - 1];
  if (!lastEvent || lastEvent.EventType !== "arv-dock") {
    return null;
  }

  const nextDepartureInSlice = findNextDepartureAfterBoundaryEvent(
    sortedEvents,
    lastEvent
  );
  if (nextDepartureInSlice) {
    return getSegmentKeyFromBoundaryKey(nextDepartureInSlice.Key);
  }

  const lookupEvents = await loadScheduledLookupEvents({
    includeNextDay: true,
  });
  const nextDeparture = findNextDepartureAfterBoundaryEvent(
    lookupEvents,
    lastEvent
  );
  if (nextDeparture) {
    return getSegmentKeyFromBoundaryKey(nextDeparture.Key);
  }

  // If the slice has ended for the service day, keep the terminal tail attached
  // to the arriving trip so the final dock stop still renders.
  return getSegmentKeyFromBoundaryKey(lastEvent.Key);
};

/**
 * Resolves the docked trip key when live state is docked but keyless.
 *
 * @param ctx - Convex query context
 * @param args - Live and active-trip context
 * @returns Deterministically inferred docked trip key, or `null`
 */
const resolveInferredDockedTripKey = async (
  _ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    SailingDay: string;
    location: {
      AtDock: boolean;
      Key?: string;
      TimeStamp: number;
      DepartingTerminalAbbrev: string;
    } | null;
    activeTrip: Pick<ConvexVesselTrip, "Key" | "PrevScheduledDeparture"> | null;
    scheduledEvents: ConvexScheduledBoundaryEvent[];
    loadScheduledLookupEvents: (args: {
      includePreviousDay?: boolean;
      includeNextDay?: boolean;
    }) => Promise<ConvexScheduledBoundaryEvent[]>;
  }
) => {
  if (!args.location?.AtDock) {
    return null;
  }

  if (args.activeTrip?.Key || args.location.Key) {
    return null;
  }

  const lookupEvents = await args.loadScheduledLookupEvents({
    includePreviousDay: true,
    includeNextDay: true,
  });

  if (args.activeTrip?.PrevScheduledDeparture !== undefined) {
    // A just-completed trip is stronger evidence than "what departure is next
    // after now?" because the next real sailing may already be late.
    const rolloverTrip = findNextDepartureEvent(lookupEvents, {
      terminalAbbrev: args.location.DepartingTerminalAbbrev,
      afterTime: args.activeTrip.PrevScheduledDeparture,
    });

    if (rolloverTrip) {
      return getSegmentKeyFromBoundaryKey(rolloverTrip.Key);
    }
  }

  const dockedTrip = findDockedDepartureEvent(
    lookupEvents,
    args.location.DepartingTerminalAbbrev,
    args.location.TimeStamp
  );

  if (dockedTrip) {
    return getSegmentKeyFromBoundaryKey(dockedTrip.Key);
  }

  // End-of-day fallback: if the visible slice ends on an arrival at the
  // vessel's current terminal, keep the vessel attached to that final dock row
  // rather than dropping the active indicator entirely.
  const lastScheduledEvent = [...args.scheduledEvents].sort(
    sortScheduledBoundaryEvents
  )[args.scheduledEvents.length - 1];

  if (
    lastScheduledEvent?.EventType === "arv-dock" &&
    lastScheduledEvent.TerminalAbbrev === args.location.DepartingTerminalAbbrev
  ) {
    // This preserves an understandable dock attachment at the end of service
    // even when the next departure has not been scheduled into the visible
    // slice.
    return getSegmentKeyFromBoundaryKey(lastScheduledEvent.Key);
  }

  return null;
};

/**
 * Loads scheduled boundary events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Scheduled boundary-event documents for that vessel/day
 */
const loadScheduledBoundaryEventsForSailingDay = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDay: string
) => {
  return await ctx.db
    .query("eventsScheduled")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
    )
    .collect();
};

/**
 * Loads the current-day event slice plus optional adjacent sailing days for
 * event-only lookup decisions.
 *
 * @param ctx - Convex query context
 * @param args - Vessel/day scope plus already-loaded current-day events
 * @returns Ordered scheduled boundary events across the requested lookup window
 */
const loadScheduledLookupEventsAroundSailingDay = async (
  ctx: QueryCtx,
  args: {
    vesselAbbrev: string;
    sailingDay: string;
    currentDayEvents: ConvexScheduledBoundaryEvent[];
    includePreviousDay?: boolean;
    includeNextDay?: boolean;
  }
) => {
  const adjacentSailingDays: string[] = [];
  if (args.includePreviousDay) {
    adjacentSailingDays.push(addDays(args.sailingDay, -1));
  }
  if (args.includeNextDay) {
    adjacentSailingDays.push(addDays(args.sailingDay, 1));
  }

  if (adjacentSailingDays.length === 0) {
    return [...args.currentDayEvents].sort(sortScheduledBoundaryEvents);
  }

  // The query contract is still "one vessel, one sailing day"; these extra
  // reads exist only to answer event-order questions that spill just beyond
  // that boundary.
  const adjacentDocs = (
    await Promise.all(
      adjacentSailingDays.map((sailingDay) =>
        loadScheduledBoundaryEventsForSailingDay(
          ctx,
          args.vesselAbbrev,
          sailingDay
        )
      )
    )
  )
    .flat()
    .map(stripConvexMeta);

  return [...args.currentDayEvents, ...adjacentDocs].sort(
    sortScheduledBoundaryEvents
  );
};

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
