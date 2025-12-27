// ============================================================================
// UNIT TESTS: Prediction Utilities
// Testing step_3_makePrediction.ts functions
// ============================================================================

// @ts-expect-error - vitest will be installed as dev dependency
import { describe, expect, test } from "vitest";
import type { FeatureRecord } from "../../convex/domain/ml/prediction/step_1_extractFeatures";
import {
  applyLinearRegression,
  atSeaDurationToEtaPred,
  combinedDurationToEtaPred,
  delayToLeftDockPred,
  roundMae,
  validatePredictionTime,
} from "../../convex/domain/ml/prediction/step_3_makePrediction";
import type { ModelParameters } from "../../convex/domain/ml/types";

describe("applyLinearRegression", () => {
  test("should calculate prediction with simple model", () => {
    const model: ModelParameters = {
      coefficients: [0.5, 0.3, 0.2],
      intercept: 10,
      trainingMetrics: { mae: 2.5, rmse: 3.0, r2: 0.85 },
      departingTerminalAbbrev: "P52",
      arrivingTerminalAbbrev: "BBI",
      modelType: "arrive-depart",
      createdAt: 1000000,
      bucketStats: {
        totalRecords: 100,
        filteredRecords: 90,
      },
    };

    const features: FeatureRecord = {
      time_center_0: 1,
      time_center_1: 0,
      time_center_2: 0,
      time_center_3: 0,
      time_center_4: 0,
      time_center_5: 0,
      time_center_6: 0,
      time_center_7: 0,
      prevDelay: 5,
      prevAtSeaDuration: 30,
    };

    const result = applyLinearRegression(model, features);

    // y = 10 + (0.5 * 1) + (0.3 * 0) + ... + (0.2 * 5) + (0.2 * 30)
    // y = 10 + 0.5 + 1 + 6 = 17.5
    expect(result).toBe(17.5);
  });

  test("should handle missing features gracefully", () => {
    const model: ModelParameters = {
      coefficients: [0.5],
      intercept: 10,
      trainingMetrics: { mae: 2.5, rmse: 3.0, r2: 0.85 },
      departingTerminalAbbrev: "P52",
      arrivingTerminalAbbrev: "BBI",
      modelType: "arrive-depart",
      createdAt: 1000000,
      bucketStats: {
        totalRecords: 100,
        filteredRecords: 90,
      },
    };

    const features: FeatureRecord = {
      time_center_0: 1,
      time_center_1: 0,
      time_center_2: 0,
      time_center_3: 0,
      time_center_4: 0,
      time_center_5: 0,
      time_center_6: 0,
      time_center_7: 0,
      // prevDelay is missing
    };

    const result = applyLinearRegression(model, features);

    expect(result).toBe(10.5);
  });

  test("should handle empty coefficients array", () => {
    const model: ModelParameters = {
      coefficients: [],
      intercept: 10,
      trainingMetrics: { mae: 2.5, rmse: 3.0, r2: 0.85 },
      departingTerminalAbbrev: "P52",
      arrivingTerminalAbbrev: "BBI",
      modelType: "arrive-depart",
      createdAt: 1000000,
      bucketStats: {
        totalRecords: 100,
        filteredRecords: 90,
      },
    };

    const features: FeatureRecord = {
      time_center_0: 1,
      time_center_1: 0,
      time_center_2: 0,
      time_center_3: 0,
      time_center_4: 0,
      time_center_5: 0,
      time_center_6: 0,
      time_center_7: 0,
    };

    const result = applyLinearRegression(model, features);

    expect(result).toBe(10);
  });
});

describe("delayToLeftDockPred", () => {
  test("should convert delay minutes to absolute timestamp", () => {
    const tripStart = new Date("2025-01-13T08:00:00-08:00").getTime();
    const predictedDelayMinutes = 15; // 15 minutes delay

    const result = delayToLeftDockPred(tripStart, predictedDelayMinutes);

    const expected = tripStart + 15 * 60000; // 15 minutes in ms
    expect(result).toBe(expected);
  });

  test("should handle zero delay", () => {
    const tripStart = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = delayToLeftDockPred(tripStart, 0);

    expect(result).toBe(tripStart);
  });

  test("should handle negative delay (early departure)", () => {
    const tripStart = new Date("2025-01-13T08:00:00-08:00").getTime();
    const predictedDelayMinutes = -5; // 5 minutes early

    const result = delayToLeftDockPred(tripStart, predictedDelayMinutes);

    const expected = tripStart - 5 * 60000;
    expect(result).toBe(expected);
  });
});

describe("combinedDurationToEtaPred", () => {
  test("should convert combined duration to absolute timestamp", () => {
    const tripStart = new Date("2025-01-13T08:00:00-08:00").getTime();
    const predictedDurationMinutes = 45; // 45 minutes total duration

    const result = combinedDurationToEtaPred(
      tripStart,
      predictedDurationMinutes
    );

    const expected = tripStart + 45 * 60000;
    expect(result).toBe(expected);
  });

  test("should handle zero duration", () => {
    const tripStart = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = combinedDurationToEtaPred(tripStart, 0);

    expect(result).toBe(tripStart);
  });
});

describe("atSeaDurationToEtaPred", () => {
  test("should convert at-sea duration to absolute timestamp", () => {
    const leftDock = new Date("2025-01-13T08:30:00-08:00").getTime();
    const predictedAtSeaMinutes = 35; // 35 minutes at sea

    const result = atSeaDurationToEtaPred(leftDock, predictedAtSeaMinutes);

    const expected = leftDock + 35 * 60000;
    expect(result).toBe(expected);
  });

  test("should handle zero at-sea duration", () => {
    const leftDock = new Date("2025-01-13T08:30:00-08:00").getTime();

    const result = atSeaDurationToEtaPred(leftDock, 0);

    expect(result).toBe(leftDock);
  });
});

describe("roundMae", () => {
  test("should round to nearest 0.01 minute", () => {
    expect(roundMae(2.567)).toBe(2.57);
    expect(roundMae(2.564)).toBe(2.56);
    expect(roundMae(2.565)).toBe(2.57);
  });

  test("should handle exact 0.01 increments", () => {
    expect(roundMae(2.5)).toBe(2.5);
    expect(roundMae(2.51)).toBe(2.51);
    expect(roundMae(2.99)).toBe(2.99);
  });

  test("should handle small values", () => {
    expect(roundMae(0.001)).toBe(0.0);
    expect(roundMae(0.005)).toBe(0.01);
    expect(roundMae(0.009)).toBe(0.01);
  });

  test("should handle large values", () => {
    expect(roundMae(10.567)).toBe(10.57);
    expect(roundMae(100.123)).toBe(100.12);
  });
});

describe("validatePredictionTime", () => {
  test("should return prediction if after minimum gap", () => {
    const predictedTime = new Date("2025-01-13T08:05:00-08:00").getTime();
    const referenceTime = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = validatePredictionTime(predictedTime, referenceTime, 2);

    expect(result).toBe(predictedTime); // 5 minutes gap, >= 2 minute minimum
  });

  test("should clamp to minimum valid time if too early", () => {
    const predictedTime = new Date("2025-01-13T08:01:00-08:00").getTime();
    const referenceTime = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = validatePredictionTime(predictedTime, referenceTime, 2);

    const minimumValidTime = referenceTime + 2 * 60000;
    expect(result).toBe(minimumValidTime); // Clamped to +2 minutes
  });

  test("should use default 2 minute minimum gap", () => {
    const predictedTime = new Date("2025-01-13T08:01:00-08:00").getTime();
    const referenceTime = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = validatePredictionTime(predictedTime, referenceTime);

    const minimumValidTime = referenceTime + 2 * 60000;
    expect(result).toBe(minimumValidTime);
  });

  test("should handle custom minimum gap", () => {
    const predictedTime = new Date("2025-01-13T08:03:00-08:00").getTime();
    const referenceTime = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = validatePredictionTime(predictedTime, referenceTime, 5);

    expect(result).toBe(predictedTime); // 3 minutes gap, < 5 minute minimum -> clamp
  });

  test("should handle prediction exactly at minimum gap", () => {
    const predictedTime = new Date("2025-01-13T08:02:00-08:00").getTime();
    const referenceTime = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = validatePredictionTime(predictedTime, referenceTime, 2);

    expect(result).toBe(predictedTime); // Exactly 2 minutes, passes
  });
});
