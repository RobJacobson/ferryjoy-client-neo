/**
 * Per-vessel trip persistence helpers used by orchestrator mutations.
 */

import type { MutationCtx } from "_generated/server";
import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import {
  areTripStorageRowsEqual,
  stripTripPredictionsForStorage,
} from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  persistVesselTripWrites,
} from "./persistVesselTripWriteSet";

type PerVesselTripWriteInput = {
  existingActiveTrip?: ConvexVesselTrip;
  activeTripUpdate?: ConvexVesselTrip;
  completedTripUpdate?: ConvexVesselTrip;
};

type PerVesselTripWrites = {
  completedTripWrite?: {
    existingTrip: ConvexVesselTrip;
    tripToComplete: ConvexVesselTrip;
    scheduleTrip: ConvexVesselTrip;
    events: TripLifecycleEventFlags;
  };
  activeTripUpsert?: ConvexVesselTrip;
  actualDockWrite?: {
    events: TripLifecycleEventFlags;
    scheduleTrip: ConvexVesselTrip;
    vesselAbbrev: string;
  };
  predictedDockWrite?: {
    existingTrip: ConvexVesselTrip | undefined;
    scheduleTrip: ConvexVesselTrip;
    vesselAbbrev: string;
  };
};

/**
 * Builds sparse trip writes from one per-vessel update payload.
 *
 * @param tripWrite - Existing/active/completed trip rows for one vessel
 * @returns Sparse trip writes consumable by trip persistence helpers
 */
export const buildTripWritesFromUpdates = (
  tripWrite: PerVesselTripWriteInput
): PerVesselTripWrites => {
  const writes: PerVesselTripWrites = {};
  const existing = tripWrite.existingActiveTrip;
  const active = tripWrite.activeTripUpdate;
  const completed = tripWrite.completedTripUpdate;

  if (completed !== undefined && existing !== undefined && active !== undefined) {
    writes.completedTripWrite = {
      existingTrip: existing,
      tripToComplete: completed,
      events: completionTripEvents(existing, completed),
      scheduleTrip: active,
    };
    return writes;
  }

  if (active === undefined) {
    return writes;
  }

  const activeUpsert = stripTripPredictionsForStorage(active);
  if (areTripStorageRowsEqual(existing, activeUpsert)) {
    return writes;
  }

  writes.activeTripUpsert = activeUpsert;
  const events = currentTripEvents(existing, activeUpsert);
  if (events.didJustLeaveDock || events.didJustArriveAtDock) {
    writes.actualDockWrite = {
      events,
      scheduleTrip: activeUpsert,
      vesselAbbrev: activeUpsert.VesselAbbrev,
    };
  }
  writes.predictedDockWrite = {
    existingTrip: existing,
    scheduleTrip: activeUpsert,
    vesselAbbrev: activeUpsert.VesselAbbrev,
  };

  return writes;
};

/**
 * Persists sparse per-vessel trip writes.
 *
 * @param ctx - Convex mutation context
 * @param tripWrite - Existing/active/completed trip rows for one vessel
 * @returns Persisted trip handoff for timeline assembly
 */
export const persistTripWritesForVessel = async (
  ctx: MutationCtx,
  tripWrite: PerVesselTripWriteInput
) => {
  const writes = buildTripWritesFromUpdates(tripWrite);
  return persistVesselTripWrites(ctx, {
    completedTripWrites:
      writes.completedTripWrite === undefined ? [] : [writes.completedTripWrite],
    activeTripUpserts:
      writes.activeTripUpsert === undefined ? [] : [writes.activeTripUpsert],
    actualDockWrites:
      writes.actualDockWrite === undefined ? [] : [writes.actualDockWrite],
    predictedDockWrites:
      writes.predictedDockWrite === undefined ? [] : [writes.predictedDockWrite],
  });
};

const completionTripEvents = (
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
