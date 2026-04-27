/**
 * Helpers for constructing sparse trip writes.
 */

import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import {
  areTripStorageRowsEqual,
  stripTripPredictionsForStorage,
} from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type VesselTripWrites = {
  completedTripWrite?: {
    existingTrip: ConvexVesselTrip;
    tripToComplete: ConvexVesselTrip;
    events: TripLifecycleEventFlags;
    scheduleTrip: ConvexVesselTrip;
  };
  activeTripUpsert?: ConvexVesselTrip;
  actualDockWrite?: {
    events: TripLifecycleEventFlags;
    scheduleTrip: ConvexVesselTrip;
    vesselAbbrev: string;
  };
  predictedDockWrite?: {
    existingTrip?: ConvexVesselTrip;
    scheduleTrip: ConvexVesselTrip;
    vesselAbbrev: string;
  };
};

type PerVesselTripUpdateInput = {
  existingActiveTrip?: ConvexVesselTrip;
  activeTripUpdate?: ConvexVesselTrip;
  completedTripUpdate?: ConvexVesselTrip;
};

/**
 * Builds sparse trip-write intents for one vessel branch update.
 *
 * This builder keeps branch write-shaping rules out of the action loop and out
 * of mutation handlers, so both layers stay simpler and more focused. It
 * encodes lifecycle precedence (completion branch first), strips non-storage
 * prediction fields, and emits only write intents that materially change
 * storage rows. The resulting payload is the handoff contract shared by
 * mutation persistence and timeline projection stages.
 *
 * @param tripUpdate - Existing trip plus active/completed update candidates
 * @returns Write-set payload consumed by orchestrator persistence
 */
export const buildTripWritesForVessel = (
  tripUpdate: PerVesselTripUpdateInput
): VesselTripWrites => {
  const existing = tripUpdate.existingActiveTrip;
  const active = tripUpdate.activeTripUpdate;
  const completed = tripUpdate.completedTripUpdate;

  // Prefer completion branch when rollover evidence exists; this encodes lifecycle order.
  if (
    completed !== undefined &&
    existing !== undefined &&
    active !== undefined
  ) {
    return {
      completedTripWrite: {
        existingTrip: existing,
        tripToComplete: completed,
        events: buildCompletionTripEvents(existing, completed),
        scheduleTrip: active,
      },
    };
  }

  // No active candidate means no write intent for this vessel branch.
  if (active === undefined) {
    return {};
  }

  // Strip prediction-only fields before comparing/persisting storage-native trip rows.
  const activeUpsert = stripTripPredictionsForStorage(active);
  // Skip write set generation when storage row is unchanged.
  if (areTripStorageRowsEqual(existing, activeUpsert)) {
    return {};
  }

  // Derive lifecycle event flags once so all downstream write intents share semantics.
  const events = currentTripEvents(existing, activeUpsert);
  return {
    activeTripUpsert: activeUpsert,
    actualDockWrite:
      events.didJustLeaveDock || events.didJustArriveAtDock
        ? {
            events,
            scheduleTrip: activeUpsert,
            vesselAbbrev: activeUpsert.VesselAbbrev,
          }
        : undefined,
    predictedDockWrite: {
      existingTrip: existing,
      scheduleTrip: activeUpsert,
      vesselAbbrev: activeUpsert.VesselAbbrev,
    },
  };
};

/**
 * Builds lifecycle flags for completed-trip rollover writes.
 *
 * @param existingTrip - Existing active trip before rollover
 * @param completedTrip - Completed trip row produced this ping
 * @returns Completion event flags for downstream persistence
 */
export const buildCompletionTripEvents = (
  existingTrip: ConvexVesselTrip,
  completedTrip: ConvexVesselTrip
): TripLifecycleEventFlags => ({
  isFirstTrip: false,
  isTripStartReady: true,
  isCompletedTrip: true,
  didJustArriveAtDock:
    completedTrip.ArrivedNextActual !== undefined &&
    existingTrip.ArrivedNextActual !== completedTrip.ArrivedNextActual,
  didJustLeaveDock: false,
  scheduleKeyChanged: existingTrip.ScheduleKey !== completedTrip.ScheduleKey,
});

/**
 * Builds lifecycle flags for active-trip upsert writes.
 *
 * @param existingTrip - Existing active trip before update, if any
 * @param nextTrip - Candidate active trip row for persistence
 * @returns Current-branch event flags for dock write intents
 */
const currentTripEvents = (
  existingTrip: ConvexVesselTrip | undefined,
  nextTrip: ConvexVesselTrip
): TripLifecycleEventFlags => ({
  isFirstTrip: existingTrip === undefined,
  isTripStartReady:
    nextTrip.DepartingTerminalAbbrev !== undefined &&
    nextTrip.ArrivingTerminalAbbrev !== undefined &&
    nextTrip.ScheduledDeparture !== undefined,
  isCompletedTrip: false,
  didJustArriveAtDock:
    existingTrip?.AtDock !== true &&
    nextTrip.AtDock === true &&
    nextTrip.ArrivedNextActual !== undefined,
  didJustLeaveDock:
    existingTrip?.AtDock === true &&
    nextTrip.AtDock !== true &&
    nextTrip.LeftDockActual !== undefined,
  scheduleKeyChanged: existingTrip?.ScheduleKey !== nextTrip.ScheduleKey,
});
