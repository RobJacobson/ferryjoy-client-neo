/**
 * Simple phase helpers for prediction runs.
 *
 * Predictions now re-run every ping whenever a trip is in the right phase for
 * that model family. There is no event/timer gate on the orchestrator path.
 */

import type { ModelType } from "domain/ml/shared/types";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/** Trip shape needed to decide which prediction family can run this ping. */
type PredictionPhaseTrip = ConvexVesselTrip;

/** Route dock-phase predictions by physical phase only (every-ping model). */
export const isAtDockPhase = (trip: PredictionPhaseTrip): boolean =>
  trip.AtDock === true;

/** Route sea-phase predictions by physical phase only (every-ping model). */
export const isAtSeaPhase = (trip: PredictionPhaseTrip): boolean =>
  trip.AtDock === false;

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
  ...(isAtDockPhase(trip) ? AT_DOCK_MODEL_TYPES : []),
  ...(isAtSeaPhase(trip) ? AT_SEA_MODEL_TYPES : []),
];
