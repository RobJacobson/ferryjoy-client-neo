/** biome-ignore-all lint/style/noNonNullAssertion: false positive */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import {
  extractFeatures,
  vesselTripToFeatureRecord,
} from "domain/ml/pipeline/shared/featureEngineering";
import type { FeatureVector, PredictionOutput } from "domain/ml/types";
import type { VesselTrip } from "functions/vesselTrips/schemas";

/**
 * Predicts both departure and arrival durations for a vessel trip
 */
export const predict = async (
  ctx: ActionCtx,
  trip: VesselTrip
): Promise<PredictionOutput> => {
  if (!trip.DepartingTerminalAbbrev || !trip.ArrivingTerminalAbbrev) {
    console.log("Missing terminal abbreviations, skipping predictions");
    return {};
  }

  const result: PredictionOutput = {};

  try {
    // Try to predict departure delay (minutes from scheduled departure)
    const departureModel = await ctx.runQuery(
      api.functions.predictions.queries.getModelParametersByTerminalPair,
      {
        departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
        arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
        modelType: "departure",
      }
    );

    if (
      departureModel?.coefficients &&
      departureModel.intercept !== undefined
    ) {
      const featureRecord = vesselTripToFeatureRecord(trip);
      const departureFeatures = extractFeatures(featureRecord);
      const departureDelay = predictWithCoefficients(
        departureFeatures,
        departureModel.coefficients,
        departureModel.intercept
      );

      result.departureDelay = departureDelay; // Can be negative for early departures

      // Calculate predicted departure time
      if (trip.ScheduledDeparture) {
        result.predictedDepartureTime = new Date(
          trip.ScheduledDeparture.getTime() + departureDelay * 60 * 1000
        );
      }
    }
  } catch (error) {
    console.log(`Failed to predict departure duration: ${error}`);
  }

  try {
    // Try to predict arrival duration (at_sea_duration)
    const arrivalModel = await ctx.runQuery(
      api.functions.predictions.queries.getModelParametersByTerminalPair,
      {
        departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
        arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
        modelType: "arrival",
      }
    );

    if (arrivalModel?.coefficients && arrivalModel.intercept !== undefined) {
      const featureRecord = vesselTripToFeatureRecord(trip);
      const arrivalFeatures = extractFeatures(featureRecord);
      const atSeaDuration = predictWithCoefficients(
        arrivalFeatures,
        arrivalModel.coefficients,
        arrivalModel.intercept
      );

      result.atSeaDuration = Math.max(0, atSeaDuration); // Ensure non-negative
    }
  } catch (error) {
    console.log(`Failed to predict arrival duration: ${error}`);
  }

  return result;
};

/**
 * Predicts duration using linear regression coefficients
 */
const predictWithCoefficients = (
  features: FeatureVector,
  coefficients: number[],
  intercept: number
): number => {
  const featureValues = Object.values(features) as number[];

  if (featureValues.length !== coefficients.length) {
    throw new Error(
      `Feature count mismatch: ${featureValues.length} vs ${coefficients.length}`
    );
  }

  const prediction = featureValues.reduce(
    (sum: number, value: number, i: number) => sum + value * coefficients[i],
    intercept
  );

  return prediction;
};
