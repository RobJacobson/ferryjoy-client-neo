/**
 * Tests for deepEqual and tripsAreEqual utilities.
 *
 * Covers: undefined handling, TimeStamp exclusion, semantic differences,
 * nested ScheduledTrip comparison.
 */
import { describe, expect, test } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deepEqual, tripsAreEqual } from "../utils";

describe("deepEqual", () => {
  test("undefined === undefined returns true", () => {
    expect(deepEqual(undefined, undefined)).toBe(true);
  });

  test("null === null returns true", () => {
    expect(deepEqual(null, null)).toBe(true);
  });

  test("undefined vs null returns false", () => {
    expect(deepEqual(undefined, null)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  test("primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  test("nested objects", () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  test("arrays", () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [1, 3])).toBe(false);
    expect(deepEqual([1], [1, 2])).toBe(false);
  });
});

describe("tripsAreEqual", () => {
  const baseTrip: ConvexVesselTrip = {
    VesselAbbrev: "TV",
    DepartingTerminalAbbrev: "TA",
    ArrivingTerminalAbbrev: "TB",
    RouteID: 0,
    RouteAbbrev: "",
    SailingDay: "2024-01-01",
    AtDock: true,
    InService: true,
    TimeStamp: 1700000000000,
  };

  test("identical trips return true", () => {
    expect(tripsAreEqual(baseTrip, { ...baseTrip })).toBe(true);
  });

  test("TimeStamp difference ignored - trips still equal", () => {
    const proposed = { ...baseTrip, TimeStamp: 1700000999999 };
    expect(tripsAreEqual(baseTrip, proposed)).toBe(true);
  });

  test("semantic difference returns false", () => {
    const proposed = { ...baseTrip, AtDock: false };
    expect(tripsAreEqual(baseTrip, proposed)).toBe(false);
  });

  test("VesselAbbrev difference returns false", () => {
    const proposed = { ...baseTrip, VesselAbbrev: "XX" };
    expect(tripsAreEqual(baseTrip, proposed)).toBe(false);
  });

  test("nested ScheduledTrip comparison", () => {
    const tripWithSched = {
      ...baseTrip,
      ScheduledTrip: {
        Key: "k1",
        VesselAbbrev: "TV",
        DepartingTerminalAbbrev: "TA",
        ArrivingTerminalAbbrev: "TB",
        DepartingTime: 1700000000000,
        SailingNotes: "",
        Annotations: [],
        RouteID: 1,
        RouteAbbrev: "R1",
        SailingDay: "2024-01-01",
        TripType: "direct" as const,
      },
    };
    expect(tripsAreEqual(tripWithSched, { ...tripWithSched })).toBe(true);

    const differentSched = {
      ...tripWithSched,
      ScheduledTrip: {
        ...tripWithSched.ScheduledTrip!,
        Key: "k2",
      },
    };
    expect(tripsAreEqual(tripWithSched, differentSched)).toBe(false);
  });
});
