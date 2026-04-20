/**
 * Simple phase helpers for prediction runs.
 *
 * Predictions now re-run every tick whenever a trip is in the right phase for
 * that model family. There is no event/timer gate on the orchestrator path.
 */

import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { ModelType } from "domain/ml/shared/types";

/** Trip shape needed to decide which prediction family can run this tick. */
type PredictionPhaseTrip = ConvexVesselTrip & {
  readonly AtDockDepartCurr?: unknown;
  readonly AtDockArriveNext?: unknown;
  readonly AtDockDepartNext?: unknown;
  readonly AtSeaArriveNext?: unknown;
  readonly AtSeaDepartNext?: unknown;
};

export const shouldRunAtDockPredictions = (
  trip: PredictionPhaseTrip
): boolean => {
  const canonicalStartAndOriginReady =
    Boolean(trip.StartTime ?? trip.TripStart) &&
    Boolean(trip.ArrivedCurrActual ?? trip.AtDockActual);

  return (
    Boolean(trip.AtDock) &&
    !trip.LeftDock &&
    canonicalStartAndOriginReady
  );
};

export const shouldRunAtSeaPredictions = (trip: PredictionPhaseTrip): boolean =>
  !trip.AtDock && Boolean(trip.LeftDockActual ?? trip.LeftDock);

const AT_DOCK_MODEL_TYPES = [
  "at-dock-depart-curr",
  "at-dock-arrive-next",
  "at-dock-depart-next",
] as const satisfies readonly ModelType[];

const AT_SEA_MODEL_TYPES = [
  "at-sea-arrive-next",
  "at-sea-depart-next",
] as const satisfies readonly ModelType[];

export const predictionModelTypesForTrip = (
  trip: PredictionPhaseTrip
): ModelType[] => [
  ...(shouldRunAtDockPredictions(trip) ? AT_DOCK_MODEL_TYPES : []),
  ...(shouldRunAtSeaPredictions(trip) ? AT_SEA_MODEL_TYPES : []),
];
