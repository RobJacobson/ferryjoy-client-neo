/**
 * Reconciles live vessel locations into actual dock-event writes.
 *
 * Scheduled boundary rows provide stable anchors for persistence only; this module
 * does not assemble presentation timelines or inferred segments for the client.
 */

import type { ConvexVesselLocation } from "../../../functions/vesselLocation/schemas";
import { groupBy } from "../../../shared/groupBy";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import { getSailingDay } from "../../../shared/time";
import type { DockEventType } from "../scheduled";
import {
  getBoundaryTime,
  getSegmentKeyFromBoundaryKey,
  sortScheduledDockEvents,
} from "../scheduled/scheduledSegmentResolvers";
import type { ConvexScheduledDockEvent } from "../scheduled/schemas";
import {
  type ActiveTripForPhysicalActualReconcile,
  enrichActualDockWritesWithTripContext,
  type TripContextForActualRow,
} from "./bindActualRowsToTrips";
import type {
  ConvexActualDockEvent,
  ConvexActualDockWrite,
  ConvexActualDockWritePersistable,
} from "./schemas";

const MOVING_SPEED_THRESHOLD = 0.2;
const DOCKED_SPEED_THRESHOLD = 0.2;

type VesselEventsByAbbrev<T extends { VesselAbbrev: string }> = Map<
  string,
  T[]
>;

type VesselLocationScheduledEventsBundle = {
  location: ConvexVesselLocation;
  vesselScheduledEvents: ConvexScheduledDockEvent[];
};

export type ReconcileActualDockWritesFromLocationsArgs = {
  sailingDay: string;
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
  vesselLocations: ConvexVesselLocation[];
  tripBySegmentKey?: Map<string, TripContextForActualRow>;
  activeTripsByVesselAbbrev?: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >;
};

export type LocationReconcileBoundaryEvent = {
  SegmentKey: string;
  Key: string;
  VesselAbbrev: string;
  SailingDay: string;
  ScheduledDeparture: number;
  TerminalAbbrev: string;
  EventType: DockEventType;
  EventScheduledTime?: number;
  EventOccurred?: true;
  EventActualTime?: number;
};

/**
 * Aligns scheduled boundaries with stored actual rows for one vessels slice.
 *
 * Sorts scheduled rows for deterministic pairing, indexes actual rows by segment
 * plus event type, then layers stale-key arrival matching so arrival confirmations
 * survive boundary-key churn between ingest passes.
 *
 * @param scheduledEvents - Planned dock boundaries for one vessel and sailing day
 * @param actualEvents - Persisted actual rows for that same vessel and day
 * @returns Neutral boundary-shaped rows carrying SegmentKey and merged occurrence state
 */
export const buildLocationReconcileBoundaryEvents = ({
  scheduledEvents,
  actualEvents,
}: {
  scheduledEvents: ConvexScheduledDockEvent[];
  actualEvents: ConvexActualDockEvent[];
}): LocationReconcileBoundaryEvent[] => {
  const sortedScheduledEvents = [...scheduledEvents].sort(
    sortScheduledDockEvents
  );
  const exactActualByScheduleKey = buildExactActualLookup(actualEvents);
  const arrivalActualByScheduledKey = buildArrivalActualLookup(
    sortedScheduledEvents,
    actualEvents,
    exactActualByScheduleKey
  );

  return sortedScheduledEvents.map((event) => {
    const actualRow =
      exactActualByScheduleKey.get(scheduledActualLookupKey(event)) ??
      arrivalActualByScheduledKey.get(event.Key);

    return {
      SegmentKey: getSegmentKeyFromBoundaryKey(event.Key),
      Key: event.Key,
      VesselAbbrev: event.VesselAbbrev,
      SailingDay: event.SailingDay,
      ScheduledDeparture: event.ScheduledDeparture,
      TerminalAbbrev: event.TerminalAbbrev,
      EventType: event.EventType,
      EventScheduledTime: event.EventScheduledTime,
      EventOccurred:
        actualRow?.EventOccurred ??
        (actualRow?.EventActualTime !== undefined ? true : undefined),
      EventActualTime: actualRow?.EventActualTime,
    };
  });
};

/**
 * Indexes actual rows that align cleanly with ScheduleKey plus event type.
 *
 * Keeps the first seen row per composite key so reconcile prefers stable schedule-backed
 * identity before heuristic arrival reassignment runs.
 *
 * @param actualEvents - Persisted actual dock rows for the reload slice
 * @returns Map from segment-plus-type key to representative actual row
 */
const buildExactActualLookup = (actualEvents: ConvexActualDockEvent[]) => {
  const actualByScheduleKeyAndType = new Map<string, ConvexActualDockEvent>();

  for (const actual of actualEvents) {
    if (!actual.ScheduleKey) {
      continue;
    }

    const key = actualLookupKey(actual.ScheduleKey, actual.EventType);
    if (!actualByScheduleKeyAndType.has(key)) {
      actualByScheduleKeyAndType.set(key, actual);
    }
  }

  return actualByScheduleKeyAndType;
};

/**
 * Builds arrival lookups when persisted rows still reference stale boundary Keys.
 *
 * Starts from exact schedule matches, then assigns remaining arrival rows by same
 * departure time at the terminal, then fills gaps in terminal arrival order without
 * double-using one physical actual EventKey.
 *
 * @param scheduledEvents - Ordered scheduled boundaries including arrivals
 * @param actualEvents - All actual rows for the vessel/day scope
 * @param exactActualByScheduleKey - Exact lookup produced by buildExactActualLookup
 * @returns Map from scheduled arrival boundary Key to best matching actual arrival row
 */
const buildArrivalActualLookup = (
  scheduledEvents: ConvexScheduledDockEvent[],
  actualEvents: ConvexActualDockEvent[],
  exactActualByScheduleKey: Map<string, ConvexActualDockEvent>
) => {
  const scheduleKeyedArrivalActuals = actualEvents
    .filter(
      (event): event is ConvexActualDockEvent & { EventActualTime: number } =>
        event.EventType === "arv-dock" &&
        event.EventActualTime !== undefined &&
        event.ScheduleKey !== undefined
    )
    .sort(
      (left, right) =>
        left.EventActualTime - right.EventActualTime ||
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.EventKey.localeCompare(right.EventKey)
    );

  const assignedArrivalActualByScheduledKey = new Map<
    string,
    ConvexActualDockEvent
  >();
  const usedActualArrivalEventKeys = new Set<string>();

  for (const event of scheduledEvents) {
    if (event.EventType !== "arv-dock") {
      continue;
    }

    const direct = exactActualByScheduleKey.get(
      scheduledActualLookupKey(event)
    );
    if (!direct) {
      continue;
    }

    assignedArrivalActualByScheduledKey.set(event.Key, direct);
    usedActualArrivalEventKeys.add(direct.EventKey);
  }

  assignSameDepartureArrivalActuals(
    scheduledEvents,
    scheduleKeyedArrivalActuals,
    assignedArrivalActualByScheduledKey,
    usedActualArrivalEventKeys
  );
  assignOrderedArrivalActuals(
    scheduledEvents,
    scheduleKeyedArrivalActuals,
    assignedArrivalActualByScheduledKey,
    usedActualArrivalEventKeys
  );

  return assignedArrivalActualByScheduledKey;
};

/**
 * Assigns arrival actuals that share terminal and scheduled departure with the slot.
 *
 * Handles cases where the stored arrival row still points at an older boundary Key
 * while schedule-shaped scheduled departure stayed aligned with the intended berth.
 *
 * @param scheduledEvents - Ordered scheduled boundaries for the vessel day
 * @param arrivalActuals - Candidate arrival rows with measurable EventActualTime
 * @param assignedArrivalActualByScheduledKey - Mutable map from scheduled Key to actual row
 * @param usedActualArrivalEventKeys - Mutable set of consumed physical EventKey values
 * @returns Nothing; mutates the map and set in place
 */
const assignSameDepartureArrivalActuals = (
  scheduledEvents: ConvexScheduledDockEvent[],
  arrivalActuals: Array<ConvexActualDockEvent & { EventActualTime: number }>,
  assignedArrivalActualByScheduledKey: Map<string, ConvexActualDockEvent>,
  usedActualArrivalEventKeys: Set<string>
) => {
  for (const event of scheduledEvents) {
    if (
      event.EventType !== "arv-dock" ||
      assignedArrivalActualByScheduledKey.has(event.Key)
    ) {
      continue;
    }

    const anchored = arrivalActuals.find(
      (actual) =>
        !usedActualArrivalEventKeys.has(actual.EventKey) &&
        actual.TerminalAbbrev === event.TerminalAbbrev &&
        actual.ScheduledDeparture === event.ScheduledDeparture
    );

    if (!anchored) {
      continue;
    }

    assignedArrivalActualByScheduledKey.set(event.Key, anchored);
    usedActualArrivalEventKeys.add(anchored.EventKey);
  }
};

/**
 * Assigns leftover arrival actuals by scanning terminal arrival order in time.
 *
 * Chooses the earliest unused arrival after the previous assignment at a pier,
 * and rejects candidates that would arrive after the next scheduled arrival slot
 * at that terminal to avoid crossing legs.
 *
 * @param scheduledEvents - Ordered scheduled boundaries for the vessel day
 * @param arrivalActuals - Candidate arrival rows sorted for deterministic picks
 * @param assignedArrivalActualByScheduledKey - Mutable map from scheduled Key to actual row
 * @param usedActualArrivalEventKeys - Mutable set of consumed physical EventKey values
 * @returns Nothing; mutates the map and set in place
 */
const assignOrderedArrivalActuals = (
  scheduledEvents: ConvexScheduledDockEvent[],
  arrivalActuals: Array<ConvexActualDockEvent & { EventActualTime: number }>,
  assignedArrivalActualByScheduledKey: Map<string, ConvexActualDockEvent>,
  usedActualArrivalEventKeys: Set<string>
) => {
  const scheduledArrivalEventsByTerminal = groupBy(
    scheduledEvents.filter((event) => event.EventType === "arv-dock"),
    (event) => event.TerminalAbbrev
  );

  for (const [
    terminalAbbrev,
    terminalArrivalEvents,
  ] of scheduledArrivalEventsByTerminal) {
    let previousAssignedArrivalActualTime: number | undefined;

    for (let index = 0; index < terminalArrivalEvents.length; index += 1) {
      const event = terminalArrivalEvents[index];
      const existing = assignedArrivalActualByScheduledKey.get(event.Key);

      if (existing?.EventActualTime !== undefined) {
        previousAssignedArrivalActualTime = existing.EventActualTime;
        continue;
      }

      const candidate = arrivalActuals.find(
        (actual) =>
          !usedActualArrivalEventKeys.has(actual.EventKey) &&
          actual.TerminalAbbrev === terminalAbbrev &&
          (previousAssignedArrivalActualTime === undefined ||
            actual.EventActualTime > previousAssignedArrivalActualTime)
      );

      if (!candidate) {
        continue;
      }

      const nextEquivalentArrival = terminalArrivalEvents[index + 1];
      if (
        nextEquivalentArrival &&
        candidate.EventActualTime > getBoundaryTime(nextEquivalentArrival)
      ) {
        continue;
      }

      assignedArrivalActualByScheduledKey.set(event.Key, candidate);
      usedActualArrivalEventKeys.add(candidate.EventKey);
      previousAssignedArrivalActualTime = candidate.EventActualTime;
    }
  }
};

/**
 * Builds the segment-plus-type lookup key used for scheduled boundary rows.
 *
 * @param event - Scheduled dock boundary whose Key encodes segment suffix
 * @returns Composite key shared with actualLookupKey for schedule-aligned joins
 */
const scheduledActualLookupKey = (event: ConvexScheduledDockEvent) =>
  actualLookupKey(getSegmentKeyFromBoundaryKey(event.Key), event.EventType);

/**
 * Concatenates segment identity with event type for Map lookups.
 *
 * @param scheduleSegment - Resolved ScheduleKey or segment string from the boundary Key
 * @param eventType - dep-dock or arv-dock discriminator
 * @returns Stable string key for exact actual row indexing
 */
const actualLookupKey = (
  scheduleSegment: string,
  eventType: ConvexScheduledDockEvent["EventType"]
) => `${scheduleSegment}|${eventType}`;

/**
 * Derives zero to two sparse writes from one live tick against a reconciled slice.
 *
 * Anchors departures and arrivals using resolveLocationBoundaryEvents, applies
 * confirmation gates from GPS-derived motion and dock sensors, and drops rows when
 * InService is false or the vessel cannot yet confirm the boundary legally.
 *
 * @param events - buildLocationReconcileBoundaryEvents output for one vessel slice
 * @param location - Latest Convex vessel location sample for that vessel
 * @returns ConvexActualDockWrite patches carrying SegmentKey for downstream enrichment
 */
export const buildActualDockWritesFromLocation = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation
): ConvexActualDockWrite[] => {
  if (events.length === 0 || location.InService !== true) {
    return [];
  }

  const { departureEvent, resolvedArrivalEvent } =
    resolveLocationBoundaryEvents(events, location);

  return [
    buildDepartureActualPatchFromLocation(location, departureEvent),
    buildArrivalActualPatchFromLocation(location, resolvedArrivalEvent),
  ].filter((patch): patch is ConvexActualDockWrite => patch !== undefined);
};

/**
 * Produces persistable actual writes for one sailing day from all live samples.
 *
 * Schedule-aligned patches enrich TripKey through tripBySegmentKey; scheduleless
 * patches cover TripKey-only active trips when representedTripBoundaryKeys does not
 * already include that boundary. Caller merges results with base rows afterward.
 *
 * @param sailingDay - Calendar sailing day string used for location filtering
 * @param scheduledEvents - Planned boundaries loaded for that reload pass
 * @param actualEvents - Existing actual rows before merge for duplicate suppression
 * @param vesselLocations - Latest locations considered part of this reconcile batch
 * @param tripBySegmentKey - Optional segment to TripKey map from trip indexes
 * @param activeTripsByVesselAbbrev - Optional active TripKey-only trips per vessel
 * @returns Persistable sparse writes ready for enrichActualDockWritesWithTripContext
 */
export const reconcileActualDockWritesFromLocations = ({
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
 * Uses ScheduledDeparture when present on the feed sample, otherwise falls back to
 * TimeStamp so midnight crossings still bucket correctly.
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

/**
 * Finds the first boundary row matching a canonical Key string.
 *
 * @param events - Candidate reconcile boundary rows for one vessel slice
 * @param Key - Stable boundary Key from scheduled or derived rows
 * @returns Matching row when present
 */
const getEventByKey = (events: LocationReconcileBoundaryEvent[], Key: string) =>
  events.find((event) => event.Key === Key);

/**
 * True when GPS and timing evidence supports confirming a departure boundary.
 *
 * @param location - Live vessel sample including motion and dock sensors
 * @param event - Candidate departure reconcile row, when defined
 * @returns True when service is active, boundary not yet occurred, and sensors show leaving dock
 */
const canConfirmDepartureFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  (location.LeftDock !== undefined || strongDeparture(location));

/**
 * True when GPS and timing evidence supports confirming an arrival boundary.
 *
 * @param location - Live vessel sample including motion and dock sensors
 * @param event - Candidate arrival reconcile row, when defined
 * @returns True when service is active, boundary open, and sensors show docking
 */
const canConfirmArrivalFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  location.InService === true &&
  event !== undefined &&
  event.EventOccurred !== true &&
  strongArrival(location);

/**
 * Builds a departure sparse write when confirmation gates pass.
 *
 * @param location - Live sample supplying LeftDock timestamps when present
 * @param event - Target departure boundary row from reconcile slice
 * @returns Sparse write or undefined when confirmation fails
 */
const buildDepartureActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  event && canConfirmDepartureFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, location.LeftDock)
    : undefined;

/**
 * Builds an arrival sparse write when confirmation gates pass.
 *
 * EventActualTime for arrivals is resolved downstream from feed timing rules rather
 * than LeftDock alone, so this passes undefined into sparseActualDockWriteFromEvent.
 *
 * @param location - Live sample evaluated at confirmation time
 * @param event - Target arrival boundary row from reconcile slice
 * @returns Sparse write or undefined when confirmation fails
 */
const buildArrivalActualPatchFromLocation = (
  location: ConvexVesselLocation,
  event: LocationReconcileBoundaryEvent | undefined
) =>
  event && canConfirmArrivalFromLocation(location, event)
    ? sparseActualDockWriteFromEvent(event, undefined)
    : undefined;

/**
 * Converts a reconcile boundary row into the sparse write shape for ingestion.
 *
 * @param event - Neutral boundary row including SegmentKey for enrichment
 * @param EventActualTime - Confirmed instant from sensors when known
 * @returns ConvexActualDockWrite always marked occurred true with sparse anchors
 */
const sparseActualDockWriteFromEvent = (
  event: LocationReconcileBoundaryEvent,
  EventActualTime: number | undefined
): ConvexActualDockWrite => ({
  SegmentKey: event.SegmentKey,
  VesselAbbrev: event.VesselAbbrev,
  SailingDay: event.SailingDay,
  ScheduledDeparture: event.ScheduledDeparture,
  TerminalAbbrev: event.TerminalAbbrev,
  EventType: event.EventType,
  EventOccurred: true,
  EventActualTime,
});

/**
 * Selects departure and arrival reconcile targets for one location tick.
 *
 * Departure and anchored arrival lookups prefer segment-keyed boundaries when the
 * feed carries an arriving terminal; arrival confirmation uses findArrivalEventForLocation
 * so eligibility respects scheduled ordering when GPS lacks a tight anchor.
 *
 * @param events - Ordered reconcile rows for one vessel day slice
 * @param location - Live sample driving confirmation decisions
 * @returns Departure row, intermediate anchored arrival, and resolved arrival candidate
 */
const resolveLocationBoundaryEvents = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation
) => {
  const departureEvent = getLocationAnchoredEvent(events, location, "dep-dock");
  const anchoredArrivalEvent = getLocationAnchoredEvent(
    events,
    location,
    "arv-dock"
  );

  return {
    departureEvent,
    anchoredArrivalEvent,
    resolvedArrivalEvent: findArrivalEventForLocation(
      events,
      location,
      departureEvent
    ),
  };
};

/**
 * Finds the reconcile row matching the vessels current leg or scheduled instant.
 *
 * Prefers explicit segment-key lookup via buildBoundaryKey when arriving-terminal
 * metadata exists; otherwise scans for vessel, event type, and scheduled departure
 * equality consistent with feed snapshots that omit segment reconstruction.
 *
 * @param events - Reconcile slice for one vessel and sailing day
 * @param location - Live sample whose terminals and schedule anchor matching
 * @param eventType - dep-dock or arv-dock boundary being resolved
 * @returns Matching LocationReconcileBoundaryEvent when found
 */
const getLocationAnchoredEvent = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation,
  eventType: DockEventType
) => {
  if (location.ScheduledDeparture === undefined) {
    return undefined;
  }

  if (location.ArrivingTerminalAbbrev) {
    const segmentKey = buildSegmentKey(
      location.VesselAbbrev,
      location.DepartingTerminalAbbrev,
      location.ArrivingTerminalAbbrev,
      new Date(location.ScheduledDeparture)
    );

    if (segmentKey) {
      const keyedEvent = getEventByKey(
        events,
        buildBoundaryKey(segmentKey, eventType)
      );

      if (keyedEvent) {
        return keyedEvent;
      }
    }
  }

  return events.find(
    (event) =>
      event.VesselAbbrev === location.VesselAbbrev &&
      event.EventType === eventType &&
      event.ScheduledDeparture === location.ScheduledDeparture &&
      (eventType === "arv-dock" ||
        event.TerminalAbbrev === location.DepartingTerminalAbbrev)
  );
};

/**
 * True when speed indicates the vessel has left the dock environment.
 *
 * Uses MOVING_SPEED_THRESHOLD so light GPS jitter near zero knots does not flip state.
 *
 * @param location - Sample with AtDock and Speed fields
 * @returns True when AtDock is false and speed meets movement threshold
 */
const strongDeparture = (location: ConvexVesselLocation) =>
  location.AtDock === false && location.Speed >= MOVING_SPEED_THRESHOLD;

/**
 * True when speed indicates the vessel has settled at the berth.
 *
 * DOCKED_SPEED_THRESHOLD pairs with strongDeparture to avoid ambiguous mid-range speeds.
 *
 * @param location - Sample with AtDock and Speed fields
 * @returns True when AtDock is true and speed is below docked threshold
 */
const strongArrival = (location: ConvexVesselLocation) =>
  location.AtDock === true && location.Speed < DOCKED_SPEED_THRESHOLD;

/**
 * Emits TripKey-only patches when schedule rows are absent but active trips exist.
 *
 * Skips boundaries already represented in representedTripBoundaryKeys so duplicate
 * schedule-aligned and physical-only emissions do not collide during merge.
 *
 * @param location - Live sample evaluated for motion-based confirmation
 * @param activeTripsByVesselAbbrev - Active TripKey-only trips keyed by vessel
 * @param representedTripBoundaryKeys - TripKey and EventType pairs already covered
 * @returns Persistable sparse writes with TripKey set and ScheduleKey undefined
 */
const buildPhysicalOnlyPatchesFromLocation = (
  location: ConvexVesselLocation,
  activeTripsByVesselAbbrev: Map<
    string,
    ActiveTripForPhysicalActualReconcile & { TripKey: string }
  >,
  representedTripBoundaryKeys: Set<string>
): ConvexActualDockWritePersistable[] => {
  if (location.InService !== true) {
    return [];
  }

  const trip = activeTripsByVesselAbbrev.get(location.VesselAbbrev);
  if (!trip || trip.ScheduleKey !== undefined) {
    return [];
  }

  const patches: ConvexActualDockWritePersistable[] = [];

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|dep-dock`) &&
    strongDeparture(location)
  ) {
    patches.push({
      TripKey: trip.TripKey,
      ScheduleKey: undefined,
      VesselAbbrev: trip.VesselAbbrev,
      ...(trip.SailingDay !== undefined ? { SailingDay: trip.SailingDay } : {}),
      ...(trip.ScheduledDeparture !== undefined
        ? { ScheduledDeparture: trip.ScheduledDeparture }
        : {}),
      TerminalAbbrev: trip.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventOccurred: true,
      EventActualTime: location.LeftDock ?? location.TimeStamp,
    });
  }

  if (
    !representedTripBoundaryKeys.has(`${trip.TripKey}|arv-dock`) &&
    strongArrival(location) &&
    trip.ArrivingTerminalAbbrev !== undefined
  ) {
    patches.push({
      TripKey: trip.TripKey,
      ScheduleKey: undefined,
      VesselAbbrev: trip.VesselAbbrev,
      ...(trip.SailingDay !== undefined ? { SailingDay: trip.SailingDay } : {}),
      ...(trip.ScheduledDeparture !== undefined
        ? { ScheduledDeparture: trip.ScheduledDeparture }
        : {}),
      TerminalAbbrev: trip.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventOccurred: true,
      EventActualTime: location.TimeStamp,
    });
  }

  return patches;
};

/**
 * Chooses which arrival boundary may be confirmed at the current feed timestamp.
 *
 * Prefers anchored arrivals scheduled before the active departure upper bound when
 * eligibility passes; otherwise searches remaining open arrivals at the departing
 * terminal that are already chronologically eligible under arrivalEligibilityTime.
 *
 * @param events - Full reconcile slice for the vessel day
 * @param location - Live sample providing TimeStamp and terminal context
 * @param departureEvent - Current departure anchor when known
 * @returns Arrival boundary eligible for confirmation, if any
 */
const findArrivalEventForLocation = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation,
  departureEvent: LocationReconcileBoundaryEvent | undefined
) => {
  const anchoredArrivalEvent = findAnchoredArrivalEvent(
    events,
    location,
    departureEvent
  );

  if (location.ScheduledDeparture !== undefined) {
    return anchoredArrivalEvent &&
      anchoredArrivalEvent.EventOccurred !== true &&
      arrivalEligibilityTime(anchoredArrivalEvent) <= location.TimeStamp
      ? anchoredArrivalEvent
      : undefined;
  }

  if (anchoredArrivalEvent) {
    return anchoredArrivalEvent.EventOccurred !== true &&
      arrivalEligibilityTime(anchoredArrivalEvent) <= location.TimeStamp
      ? anchoredArrivalEvent
      : undefined;
  }

  return [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.EventOccurred !== true &&
        arrivalEligibilityTime(event) <= location.TimeStamp
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

/**
 * Picks the latest scheduled arrival before the upper bound departure instant.
 *
 * Filters arrivals at the departing terminal with scheduled departure strictly
 * before the bound, then sorts descending so the nearest upcoming arrival wins.
 *
 * @param events - Reconcile slice for the vessel day
 * @param location - Provides DepartingTerminalAbbrev context for terminal filtering
 * @param departureEvent - Optional departure row establishing the upper bound instant
 * @returns Candidate anchored arrival row when one exists
 */
const findAnchoredArrivalEvent = (
  events: LocationReconcileBoundaryEvent[],
  location: ConvexVesselLocation,
  departureEvent: LocationReconcileBoundaryEvent | undefined
) => {
  const scheduledDepartureUpperBound =
    departureEvent?.ScheduledDeparture ?? location.ScheduledDeparture;

  if (scheduledDepartureUpperBound === undefined) {
    return undefined;
  }

  return [...events]
    .filter(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === location.DepartingTerminalAbbrev &&
        event.ScheduledDeparture < scheduledDepartureUpperBound
    )
    .sort(
      (left, right) => right.ScheduledDeparture - left.ScheduledDeparture
    )[0];
};

/**
 * Computes the earliest wall-clock instant where confirmation is considered safe.
 *
 * Uses the minimum of scheduled departure and explicit EventScheduledTime so feeds
 * that publish tighter berth windows gate confirmation earlier than coarse depart times.
 *
 * @param event - Arrival reconcile row under evaluation
 * @returns Millisecond timestamp threshold for eligibility comparisons
 */
const arrivalEligibilityTime = (event: LocationReconcileBoundaryEvent) =>
  Math.min(
    event.ScheduledDeparture,
    event.EventScheduledTime ?? Number.POSITIVE_INFINITY
  );
