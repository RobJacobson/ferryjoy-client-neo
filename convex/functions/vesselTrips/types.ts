/**
 * Defines TS-native vessel-trip DTOs and converters for functions callers.
 *
 * Wire validators and inferred row types stay in schemas.ts; this module owns
 * Date-shaped projections used by in-memory trip and UI-facing code paths.
 */

import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import { toScheduledTrip } from "functions/scheduledTrips/types";
import {
  epochMsToDate,
  optionalEpochMsToDate,
} from "../../shared/convertDates";
import type {
  ConvexJoinedTripPrediction,
  ConvexPrediction,
  ConvexVesselTrip,
  ConvexVesselTripWithPredictions,
} from "./schemas";

/**
 * TS-native prediction with Date timestamp fields.
 */
type Prediction = {
  PredTime: Date;
  MinTime: Date;
  MaxTime: Date;
  MAE: number;
  StdDev: number;
  Actual?: Date;
  DeltaTotal?: number;
  DeltaRange?: number;
};

/**
 * TS-native joined prediction with Date timestamp fields.
 */
type JoinedPrediction = {
  PredTime: Date;
  Actual?: Date;
  DeltaTotal?: number;
};

/**
 * Converts a full wire prediction payload to the TS-native Date-shaped DTO.
 *
 * @param convexPrediction - Full prediction payload with epoch-ms fields
 * @returns Prediction with Date time fields
 */
const toPrediction = (convexPrediction: ConvexPrediction): Prediction => ({
  PredTime: epochMsToDate(convexPrediction.PredTime),
  MinTime: epochMsToDate(convexPrediction.MinTime),
  MaxTime: epochMsToDate(convexPrediction.MaxTime),
  MAE: convexPrediction.MAE,
  StdDev: convexPrediction.StdDev,
  Actual: optionalEpochMsToDate(convexPrediction.Actual),
  DeltaTotal: convexPrediction.DeltaTotal,
  DeltaRange: convexPrediction.DeltaRange,
});

/**
 * Converts a joined wire prediction payload to the TS-native Date-shaped DTO.
 *
 * @param convexJoinedPrediction - Minimal joined prediction with epoch-ms fields
 * @returns Joined prediction with Date time fields
 */
const toJoinedPrediction = (
  convexJoinedPrediction: ConvexJoinedTripPrediction
): JoinedPrediction => ({
  PredTime: epochMsToDate(convexJoinedPrediction.PredTime),
  Actual: optionalEpochMsToDate(convexJoinedPrediction.Actual),
  DeltaTotal: convexJoinedPrediction.DeltaTotal,
});

/**
 * Converts a wire vessel trip to the TS-native Date-shaped DTO.
 *
 * @param convexVesselTrip - Trip row with epoch-ms fields and optional predictions
 * @returns Vessel trip with Date fields and mapped prediction payloads
 */
const toVesselTrip = (
  convexVesselTrip:
    | ConvexVesselTripWithPredictions
    | (ConvexVesselTrip & Record<string, unknown>)
) => ({
  ...convexVesselTrip,
  TripStart: optionalEpochMsToDate(convexVesselTrip.TripStart),
  TripEnd: optionalEpochMsToDate(convexVesselTrip.TripEnd),
  ScheduledDeparture: optionalEpochMsToDate(
    convexVesselTrip.ScheduledDeparture
  ),
  NextScheduledDeparture: optionalEpochMsToDate(
    convexVesselTrip.NextScheduledDeparture
  ),
  Eta: optionalEpochMsToDate(convexVesselTrip.Eta),
  LeftDock: optionalEpochMsToDate(convexVesselTrip.LeftDock),
  LeftDockActual: optionalEpochMsToDate(convexVesselTrip.LeftDockActual),
  TimeStamp: epochMsToDate(convexVesselTrip.TimeStamp),
  AtDockDepartCurr: mapPredictionField(convexVesselTrip.AtDockDepartCurr),
  AtDockArriveNext: mapPredictionField(convexVesselTrip.AtDockArriveNext),
  AtDockDepartNext: mapPredictionField(convexVesselTrip.AtDockDepartNext),
  AtSeaArriveNext: mapPredictionField(convexVesselTrip.AtSeaArriveNext),
  AtSeaDepartNext: mapPredictionField(convexVesselTrip.AtSeaDepartNext),
});

/**
 * Converts a wire vessel trip plus optional joined schedule row to TS-native DTO.
 *
 * @param convexVesselTrip - Trip row with optional joined scheduled trip
 * @returns TS-native trip with optional TS-native scheduled trip
 */
const toVesselTripWithScheduledTrip = (
  convexVesselTrip: ConvexVesselTripWithPredictions & {
    ScheduledTrip?: ConvexScheduledTrip;
  }
): VesselTripWithScheduledTrip => {
  const vesselTrip = toVesselTrip(convexVesselTrip);
  const scheduledTrip = convexVesselTrip.ScheduledTrip
    ? toScheduledTrip(convexVesselTrip.ScheduledTrip)
    : undefined;
  return { ...vesselTrip, ScheduledTrip: scheduledTrip };
};

/**
 * TS-native vessel trip with Date timestamp fields.
 */
type VesselTrip = ReturnType<typeof toVesselTrip>;

/**
 * TS-native vessel trip plus optional TS-native scheduled trip projection.
 */
type VesselTripWithScheduledTrip = VesselTrip & {
  ScheduledTrip?: ReturnType<typeof toScheduledTrip>;
};

/**
 * Maps an optional prediction payload into the corresponding TS-native DTO.
 *
 * @param value - Joined or full prediction payload from a trip field
 * @returns TS-native prediction, or undefined when missing
 */
const mapPredictionField = (
  value: unknown
): Prediction | JoinedPrediction | undefined => {
  if (value === undefined) {
    return undefined;
  }
  const candidate = value as {
    PredTime?: number;
    MinTime?: number;
    MAE?: number;
  };
  if (candidate.MinTime !== undefined && candidate.MAE !== undefined) {
    return toPrediction(value as ConvexPrediction);
  }
  return toJoinedPrediction(value as ConvexJoinedTripPrediction);
};

export type {
  JoinedPrediction,
  Prediction,
  VesselTrip,
  VesselTripWithScheduledTrip,
};
export {
  toJoinedPrediction,
  toPrediction,
  toVesselTrip,
  toVesselTripWithScheduledTrip,
};
