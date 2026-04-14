/**
 * Pure derivation of sparse actual-boundary patches for one sailing day from
 * already-loaded scheduled rows, base actual rows, and live `vesselLocations`
 * (reseed / replace path only). Returns persistable patches for
 * `mergeActualBoundaryPatchesIntoRows` in `functions/vesselTimeline`, not a
 * merged timeline event list.
 */

import type {
  ConvexActualBoundaryEvent,
  ConvexActualBoundaryPatchPersistable,
} from "../../../functions/eventsActual/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import { groupBy } from "../../../shared/groupBy";
import { getSailingDay } from "../../../shared/time";
import { mergeTimelineEvents } from "../timelineEvents";
import {
  enrichActualBoundaryPatchesWithTripContext,
  type TripContextForActualRow,
} from "../tripContextForActualRows";
import { buildActualBoundaryPatchesFromLocation } from "./liveUpdates";

type VesselEventsByAbbrev<T extends { VesselAbbrev: string }> = Map<
  string,
  T[]
>;

type VesselLocationScheduledEventsBundle = {
  location: ConvexVesselLocation;
  vesselScheduledEvents: ConvexScheduledBoundaryEvent[];
};

export type BuildActualBoundaryPatchesForSailingDayArgs = {
  sailingDay: string;
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  vesselLocations: ConvexVesselLocation[];
  /** When set, patches are enriched with `TripKey` / `ScheduleKey` for PR3. */
  tripBySegmentKey?: Map<string, TripContextForActualRow>;
};

/**
 * Collects sparse actual-boundary patches for one sailing day from live
 * locations and the candidate scheduled/actual tables. Output is merged into
 * final `eventsActual` rows by the vessel-timeline replace mutation.
 *
 * @param args.sailingDay - Target service day string
 * @param args.scheduledEvents - Normalized scheduled boundary rows for the day
 * @param args.actualEvents - Base actual rows (e.g. from hydrated events)
 * @param args.vesselLocations - Current live locations for all vessels
 * @returns Patches suitable for `mergeActualBoundaryPatchesIntoRows`
 */
export const buildActualBoundaryPatchesForSailingDay = ({
  sailingDay,
  scheduledEvents,
  actualEvents,
  vesselLocations,
  tripBySegmentKey = new Map(),
}: BuildActualBoundaryPatchesForSailingDayArgs): ConvexActualBoundaryPatchPersistable[] => {
  const scheduledByVessel = groupBy(scheduledEvents, (e) => e.VesselAbbrev);
  const actualByVessel = groupBy(actualEvents, (e) => e.VesselAbbrev);

  const raw = vesselLocations
    .map(attachScheduledEventsByVessel(scheduledByVessel))
    .filter(locationBundleMatchesSailingDay(sailingDay))
    .filter(hasScheduledEvents)
    .flatMap(actualBoundaryPatchesFromLocationBundle(actualByVessel));

  return enrichActualBoundaryPatchesWithTripContext(raw, tripBySegmentKey);
};

/**
 * Builds a mapper that pairs each vessel location with scheduled events.
 *
 * @param scheduledByVessel - Scheduled rows grouped by vessel abbreviation
 * @returns Callback for `Array#map`
 */
const attachScheduledEventsByVessel =
  (scheduledByVessel: VesselEventsByAbbrev<ConvexScheduledBoundaryEvent>) =>
  (location: ConvexVesselLocation): VesselLocationScheduledEventsBundle => ({
    location,
    vesselScheduledEvents: scheduledByVessel.get(location.VesselAbbrev) ?? [],
  });

/**
 * Builds a predicate that keeps bundles whose location is on the sailing day.
 *
 * @param sailingDay - Target sailing day string
 * @returns Callback for `Array#filter`
 */
const locationBundleMatchesSailingDay =
  (sailingDay: string) =>
  ({ location }: VesselLocationScheduledEventsBundle) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

/**
 * Builds a predicate that keeps bundles with at least one scheduled event.
 *
 * @param bundle - Location plus same-vessel scheduled events
 * @returns True when the bundle has scheduled events to reconcile
 */
const hasScheduledEvents = ({
  vesselScheduledEvents,
}: VesselLocationScheduledEventsBundle) => vesselScheduledEvents.length > 0;

/**
 * Builds a flat-mapper that derives actual-boundary patches from a location
 * bundle.
 *
 * @param actualByVessel - Actual boundary rows grouped by vessel abbreviation
 * @returns Callback for `Array#flatMap`
 */
const actualBoundaryPatchesFromLocationBundle =
  (actualByVessel: VesselEventsByAbbrev<ConvexActualBoundaryEvent>) =>
  ({ location, vesselScheduledEvents }: VesselLocationScheduledEventsBundle) =>
    buildActualBoundaryPatchesFromLocation(
      mergeTimelineEvents({
        scheduledEvents: vesselScheduledEvents,
        actualEvents: actualByVessel.get(location.VesselAbbrev) ?? [],
        predictedEvents: [],
      }),
      location
    );
