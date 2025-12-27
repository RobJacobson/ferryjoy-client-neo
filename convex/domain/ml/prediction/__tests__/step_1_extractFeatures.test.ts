// ============================================================================
// UNIT TESTS: Feature Extraction Utilities
// Testing step_1_extractFeatures.ts functions
// ============================================================================
  
// @ts-ignore - vitest will be installed as dev dependency
import { describe, expect, test } from "vitest";
import {
  extractArriveBeforeFeatures,
  extractArriveDepartFeatures,
  extractDepartArriveFeatures,
  extractTimeBasedFeatures,
} from "../step_1_extractFeatures";

describe("extractTimeBasedFeatures", () => {
  test("should extract time features for weekday morning", () => {
    const result = extractTimeBasedFeatures(
      new Date("2025-01-13T08:00:00-08:00").getTime()
    );

    expect(result.isWeekend).toBe(0);
    expect(result.timeFeatures).toBeDefined();
    expect(result.timeFeatures.time_center_0).toBeDefined();
  });

  test("should identify weekend correctly", () => {
    const saturday = new Date("2025-01-11T08:00:00-08:00").getTime();
    const sunday = new Date("2025-01-12T08:00:00-08:00").getTime();

    expect(extractTimeBasedFeatures(saturday).isWeekend).toBe(1);
    expect(extractTimeBasedFeatures(sunday).isWeekend).toBe(1);
  });

  test("should identify weekday correctly", () => {
    const monday = new Date("2025-01-13T08:00:00-08:00").getTime();
    const wednesday = new Date("2025-01-15T08:00:00-08:00").getTime();

    expect(extractTimeBasedFeatures(monday).isWeekend).toBe(0);
    expect(extractTimeBasedFeatures(wednesday).isWeekend).toBe(0);
  });

  test("should handle undefined scheduled departure", () => {
    const result = extractTimeBasedFeatures(undefined);

    expect(result.timeFeatures).toBeDefined();
    expect(result.isWeekend).toBe(0);
  });
});

describe("extractArriveBeforeFeatures", () => {
  test("should calculate arrive before minutes correctly", () => {
    const tripStart = new Date("2025-01-13T06:00:00-08:00").getTime();
    const scheduledDeparture = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = extractArriveBeforeFeatures(
      tripStart,
      scheduledDeparture,
      "P52-BBI"
    );

    expect(result.arriveBeforeMinutes).toBe(120); // 2 hours = 120 minutes
  });

  test("should handle early arrival", () => {
    const tripStart = new Date("2025-01-13T07:00:00-08:00").getTime();
    const scheduledDeparture = new Date("2025-01-13T08:00:00-08:00").getTime();

    const result = extractArriveBeforeFeatures(
      tripStart,
      scheduledDeparture,
      "P52-BBI"
    );

    expect(result.arriveBeforeMinutes).toBe(60);
    expect(result.arriveEarlyMinutes).toBeDefined();
  });

  test("should handle undefined scheduled departure", () => {
    const tripStart = new Date("2025-01-13T06:00:00-08:00").getTime();

    const result = extractArriveBeforeFeatures(tripStart, undefined, "P52-BBI");

    expect(result.arriveBeforeMinutes).toBeGreaterThan(0);
    expect(result.arriveEarlyMinutes).toBeDefined();
  });
});

describe("extractArriveDepartFeatures", () => {
  test("should extract all features for arrive-depart model", () => {
    const scheduledDeparture = new Date("2025-01-13T08:00:00-08:00").getTime();
    const prevDelay = 5.5;
    const prevAtSeaDuration = 35.2;
    const tripStart = new Date("2025-01-13T06:00:00-08:00").getTime();
    const terminalPairKey = "P52-BBI";

    const result = extractArriveDepartFeatures(
      scheduledDeparture,
      prevDelay,
      prevAtSeaDuration,
      tripStart,
      terminalPairKey
    );

    expect(result.isWeekend).toBe(0);
    expect(result.prevDelay).toBe(prevDelay);
    expect(result.prevAtSeaDuration).toBe(prevAtSeaDuration);
    expect(result.arriveBeforeMinutes).toBe(120);
    expect(result.time_center_0).toBeDefined();
  });

  test("should handle weekend features", () => {
    const saturday = new Date("2025-01-11T08:00:00-08:00").getTime();

    const result = extractArriveDepartFeatures(
      saturday,
      5.5,
      35.2,
      saturday - 7200000,
      "P52-BBI"
    );

    expect(result.isWeekend).toBe(1);
  });

  test("should handle undefined scheduled departure", () => {
    const result = extractArriveDepartFeatures(
      undefined,
      5.5,
      35.2,
      Date.now(),
      "P52-BBI"
    );

    expect(result).toBeDefined();
    expect(result.timeFeatures).toBeDefined();
  });
});

describe("extractDepartArriveFeatures", () => {
  test("should extract all features for depart-arrive model", () => {
    const scheduledDeparture = new Date("2025-01-13T08:00:00-08:00").getTime();
    const atDockDuration = 15.5;
    const delay = 3.2;

    const result = extractDepartArriveFeatures(
      scheduledDeparture,
      atDockDuration,
      delay
    );

    expect(result.isWeekend).toBe(0);
    expect(result.atDockDuration).toBe(atDockDuration);
    expect(result.delay).toBe(delay);
    expect(result.time_center_0).toBeDefined();
  });

  test("should handle undefined atDockDuration", () => {
    const result = extractDepartArriveFeatures(Date.now(), undefined, 5.0);

    expect(result.atDockDuration).toBe(0);
    expect(result.delay).toBe(5.0);
  });

  test("should handle undefined delay", () => {
    const result = extractDepartArriveFeatures(Date.now(), 15.5, undefined);

    expect(result.atDockDuration).toBe(15.5);
    expect(result.delay).toBe(0);
  });
});
