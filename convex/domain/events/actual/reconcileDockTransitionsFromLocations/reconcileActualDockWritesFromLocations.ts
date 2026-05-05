/**
 * Top-level reconcile orchestrator that assembles sparse actual writes.
 *
 * Joins three building blocks into one pass: schedule-aligned patches enrich
 * TripKey through tripBySegmentKey; scheduleless patches cover TripKey-only
 * active trips when their boundary is not already represented; both feeds
 * concatenate into the persistable write stream consumed by merge. Keeping
 * the orchestrator small isolates the join from the per-block helpers so each
 * stage stays unit-testable.
 */

import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../../../../functions/vesselLocation/schemas";
import { groupBy } from "../../../../shared/groupBy";
import { getSailingDay } from "../../../../shared/time";
import { enrichActualDockWritesWithTripContext } from "../bindActualRowsToTrips";
import type { ConvexActualDockWritePersistable } from "../schemas";
import { buildLocationReconcileBoundaryEvents } from "./alignActualEventsToScheduledBoundaries";
import { buildActualDockWritesFromLocation } from "./buildActualDockWritesFromLocation";
import { buildPhysicalOnlyPatchesFromLocation } from "./buildPhysicalOnlyPatchesFromLocation";
import type {
  ReconcileActualDockWritesFromLocationsArgs,
  VesselEventsByAbbrev,
  VesselLocationScheduledEventsBundle,
} from "./types";

/**
 * Produces persistable actual writes for one sailing day from all live samples.
 *
 * Schedule-aligned patches enrich TripKey through tripBySegmentKey;
 * scheduleless patches cover TripKey-only active trips when
 * representedTripBoundaryKeys does not already include that boundary. Caller
 * merges results with base rows afterward.
 *
 * @param scheduledEvents - Planned boundaries loaded for that reload pass
 * @param actualEvents - Existing actual rows before merge for duplicate suppression
 * @param vesselLocations - Latest locations considered part of this reconcile batch
 * @param tripBySegmentKey - Optional segment to TripKey map from trip indexes
 * @param activeTripsByVesselAbbrev - Optional active TripKey-only trips per vessel
 * @param sailingDay - Calendar sailing day string used for location filtering
 * @returns Persistable sparse writes ready for enrichActualDockWritesWithTripContext
 */
const reconcileActualDockWritesFromLocations = ({
  sailingDay,
  scheduledEvents,
  actualEvents,
  vesselLocations,
  tripBySegmentKey = new Map(),
  activeTripsByVesselAbbrev = new Map(),
}: ReconcileActualDockWritesFromLocationsArgs): ConvexActualDockWritePersistable[] => {
  const scheduledByVessel = groupBy(scheduledEvents, (e) => e.VesselAbbrev);
  const actualByVessel = groupBy(actualEvents, (e) => e.VesselAbbrev);

  const scheduleAligned = vesselLocations
    .map(attachScheduledEventsByVessel(scheduledByVessel))
    .filter(locationBundleMatchesSailingDay(sailingDay))
    .filter(hasScheduledEvents)
    .flatMap(actualDockWritesFromLocationBundle(actualByVessel));

  const scheduleAlignedWithTripContext = enrichActualDockWritesWithTripContext(
    scheduleAligned,
    tripBySegmentKey
  );
  const representedTripBoundaryKeys = new Set(
    [
      ...actualEvents,
      ...scheduleAlignedWithTripContext.map((patch) => ({
        TripKey: patch.TripKey,
        EventType: patch.EventType,
      })),
    ].map((row) => `${row.TripKey}|${row.EventType}`)
  );

  const scheduleless = vesselLocations
    .filter(locationMatchesSailingDay(sailingDay))
    .flatMap((location) =>
      buildPhysicalOnlyPatchesFromLocation(
        location,
        activeTripsByVesselAbbrev,
        representedTripBoundaryKeys
      )
    );

  return [...scheduleAlignedWithTripContext, ...scheduleless];
};

/**
 * Curries vessel-grouped scheduled rows into a mapper over raw locations.
 *
 * @param scheduledByVessel - Map from vessel abbreviation to scheduled boundaries
 * @returns Function that bundles one location with its candidate scheduled rows
 */
const attachScheduledEventsByVessel =
  (scheduledByVessel: VesselEventsByAbbrev<ConvexScheduledDockEvent>) =>
  (location: ConvexVesselLocation): VesselLocationScheduledEventsBundle => ({
    location,
    vesselScheduledEvents: scheduledByVessel.get(location.VesselAbbrev) ?? [],
  });

/**
 * Builds a predicate that keeps bundles whose location belongs to the sailing day.
 *
 * @param sailingDay - Target calendar sailing day string
 * @returns Predicate accepting bundles whose locations sailing day matches
 */
const locationBundleMatchesSailingDay =
  (sailingDay: string) =>
  ({ location }: VesselLocationScheduledEventsBundle) =>
    locationMatchesSailingDay(sailingDay)(location);

/**
 * Predicate factory that tests whether a locations inferred day matches the target.
 *
 * Uses ScheduledDeparture when present on the feed sample, otherwise falls
 * back to TimeStamp so midnight crossings still bucket correctly.
 *
 * @param sailingDay - Calendar sailing day string to compare against
 * @returns Predicate over ConvexVesselLocation returning true when days match
 */
const locationMatchesSailingDay =
  (sailingDay: string) => (location: ConvexVesselLocation) =>
    getSailingDay(
      new Date(location.ScheduledDeparture ?? location.TimeStamp)
    ) === sailingDay;

/**
 * True when the bundle includes at least one scheduled boundary for reconciliation.
 *
 * @param bundle - Location paired with zero or more scheduled rows for that vessel
 * @returns True when vesselScheduledEvents is non-empty
 */
const hasScheduledEvents = ({
  vesselScheduledEvents,
}: VesselLocationScheduledEventsBundle) => vesselScheduledEvents.length > 0;

/**
 * Maps one bundle through merge-aware boundary construction and sparse patch synthesis.
 *
 * @param actualByVessel - Actual rows grouped by vessel abbreviation for lookups
 * @returns Function that emits sparse writes for a single bundle instance
 */
const actualDockWritesFromLocationBundle =
  (actualByVessel: VesselEventsByAbbrev<ConvexActualDockEvent>) =>
  ({ location, vesselScheduledEvents }: VesselLocationScheduledEventsBundle) =>
    buildActualDockWritesFromLocation(
      buildLocationReconcileBoundaryEvents({
        scheduledEvents: vesselScheduledEvents,
        actualEvents: actualByVessel.get(location.VesselAbbrev) ?? [],
      }),
      location
    );

export { reconcileActualDockWritesFromLocations };
