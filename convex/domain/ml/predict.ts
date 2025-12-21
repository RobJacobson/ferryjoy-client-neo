/** biome-ignore-all lint/style/noNonNullAssertion: false positive */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
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

  const result: PredictionOutput = {
    confidence: {
      delayLower: 0,
      delayUpper: 0,
      seaLower: 0,
      seaUpper: 0,
    },
  };

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
      const departureFeatures = extractDepartureFeatures(trip);
      const departureDelay = predictWithCoefficients(
        departureFeatures,
        departureModel.coefficients,
        departureModel.intercept
      );

      // Calculate confidence interval (using residual std dev approximation)
      const confidence = calculateConfidenceInterval(
        departureDelay,
        departureModel.trainingMetrics?.stdDev || 10 // fallback std dev
      );

      result.departureDelay = departureDelay; // Can be negative for early departures

      // Calculate predicted departure time
      if (trip.ScheduledDeparture) {
        result.predictedDepartureTime = new Date(
          trip.ScheduledDeparture.getTime() + departureDelay * 60 * 1000
        );
      }

      result.confidence!.delayLower = confidence.lower;
      result.confidence!.delayUpper = confidence.upper;
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
      const arrivalFeatures = extractArrivalFeatures(trip);
      const atSeaDuration = predictWithCoefficients(
        arrivalFeatures,
        arrivalModel.coefficients,
        arrivalModel.intercept
      );

      // Calculate confidence interval
      const confidence = calculateConfidenceInterval(
        atSeaDuration,
        arrivalModel.trainingMetrics?.stdDev || 15 // fallback std dev
      );

      result.atSeaDuration = Math.max(0, atSeaDuration); // Ensure non-negative
      result.confidence!.seaLower = Math.max(0, confidence.lower);
      result.confidence!.seaUpper = confidence.upper;
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
  const featureValues = Object.values(features);

  if (featureValues.length !== coefficients.length) {
    throw new Error(
      `Feature count mismatch: ${featureValues.length} vs ${coefficients.length}`
    );
  }

  const prediction = featureValues.reduce(
    (sum, value, i) => sum + value * coefficients[i],
    intercept
  );

  return prediction;
};

/**
 * Categorize hour of day into ferry operation time periods
 * Returns 0-5 representing different operational patterns:
 * 0: Late night/Early morning (quietest, most predictable)
 * 1: Early morning prep
 * 2: Morning rush hour
 * 3: Midday
 * 4: Afternoon rush hour
 * 5: Evening
 */
const getTimeOfDayCategory = (hour: number): number => {
  if (hour >= 22 || hour < 5) return 0; // Late night/Early morning (22:00-04:59)
  if (hour >= 5 && hour < 7) return 1; // Early morning prep (05:00-06:59)
  if (hour >= 7 && hour < 10) return 2; // Morning rush (07:00-09:59)
  if (hour >= 10 && hour < 15) return 3; // Midday (10:00-14:59)
  if (hour >= 15 && hour < 18) return 4; // Afternoon rush (15:00-17:59)
  if (hour >= 18 && hour < 22) return 5; // Evening (18:00-21:59)
  return 0; // Fallback
};

/**
 * Extracts features for departure model prediction
 * IMPORTANT: Only use features available at the time of vessel arrival
 */
const extractDepartureFeatures = (trip: VesselTrip): FeatureVector => {
  const scheduleDelta = calculateScheduleDelta(trip);
  const scheduleDeltaClamped = Math.min(20, Math.max(-Infinity, scheduleDelta));
  const hourOfDay = trip.TripStart!.getHours();
  const timeCategory = getTimeOfDayCategory(hourOfDay);
  const isWeekend =
    trip.TripStart!.getDay() === 0 || trip.TripStart!.getDay() === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    time_category: timeCategory, // Using categorical time periods for ferry operations
    is_weekend: isWeekend ? 1 : 0,
  };
};

/**
 * Extracts features for arrival model prediction
 */
const extractArrivalFeatures = (trip: VesselTrip): FeatureVector => {
  const scheduleDelta = calculateScheduleDelta(trip);
  const scheduleDeltaClamped = Math.min(20, Math.max(-Infinity, scheduleDelta));
  const hourOfDay = trip.LeftDock!.getHours();
  const timeCategory = getTimeOfDayCategory(hourOfDay);
  const isWeekend =
    trip.LeftDock!.getDay() === 0 || trip.LeftDock!.getDay() === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    time_category: timeCategory, // Using categorical time periods for ferry operations
    is_weekend: isWeekend ? 1 : 0,
    delay_minutes: trip.Delay || 0,
  };
};

/**
 * Calculates schedule delta in minutes (positive = ahead of schedule)
 */
const calculateScheduleDelta = (trip: VesselTrip): number => {
  const arrivalTime = trip.TripStart!.getTime();
  const scheduledTime = trip.ScheduledDeparture!.getTime();
  return (scheduledTime - arrivalTime) / (1000 * 60); // Convert to minutes
};

/**
 * Calculates confidence interval using standard deviation
 */
const calculateConfidenceInterval = (
  prediction: number,
  stdDev: number,
  confidenceLevel: number = 1.96 // ~95% confidence
): { lower: number; upper: number } => {
  const margin = confidenceLevel * stdDev;
  return {
    lower: prediction - margin,
    upper: prediction + margin,
  };
};
