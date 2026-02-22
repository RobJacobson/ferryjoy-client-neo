/**
 * Unit tests for tripEquality (deepEqual, tripsAreEqual).
 */

import { describe, expect, test } from "bun:test";
import type { ConvexVesselTrip } from "../../schemas";
import { deepEqual, tripsAreEqual } from "../tripEquality";

describe("deepEqual", () => {
  test("undefined === undefined", () => {
    expect(deepEqual(undefined, undefined)).toBe(true);
  });

  test("null === null", () => {
    expect(deepEqual(null, null)).toBe(true);
  });

  test("undefined !== null", () => {
    expect(deepEqual(undefined, null)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  test("primitives", () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual("a", "a")).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
  });

  test("arrays", () => {
    expect(deepEqual([1, 2], [1, 2])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([], [])).toBe(true);
  });

  test("objects", () => {
    expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  test("nested objects", () => {
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });
});

describe("tripsAreEqual", () => {
  const baseTrip: ConvexVesselTrip = {
    VesselAbbrev: "KODIAK",
    DepartingTerminalAbbrev: "BBI",
    ArrivingTerminalAbbrev: "SEA",
    RouteID: 1,
    RouteAbbrev: "SEA-BI",
    Key: "key1",
    SailingDay: "2026-02-22",
    AtDock: true,
    InService: true,
    TimeStamp: 1000,
  };

  test("identical trips are equal", () => {
    expect(tripsAreEqual(baseTrip, { ...baseTrip })).toBe(true);
  });

  test("TimeStamp difference is ignored", () => {
    const other = { ...baseTrip, TimeStamp: 9999 };
    expect(tripsAreEqual(baseTrip, other)).toBe(true);
  });

  test("semantic field difference returns false", () => {
    const other = { ...baseTrip, VesselAbbrev: "OTHER" };
    expect(tripsAreEqual(baseTrip, other)).toBe(false);
  });

  test("undefined vs undefined for optional field", () => {
    const a = { ...baseTrip, Key: undefined };
    const b = { ...baseTrip, Key: undefined };
    expect(tripsAreEqual(a, b)).toBe(true);
  });

  test("nested ScheduledTrip comparison", () => {
    const scheduled = {
      VesselAbbrev: "KODIAK",
      DepartingTerminalAbbrev: "BBI",
      ArrivingTerminalAbbrev: "SEA",
      DepartingTime: 1000,
      SailingNotes: "",
      Annotations: [],
      RouteID: 1,
      RouteAbbrev: "R1",
      Key: "st1",
      SailingDay: "2026-02-22",
      TripType: "direct" as const,
      NextDepartingTime: 2000,
    };
    const withScheduled = { ...baseTrip, ScheduledTrip: scheduled };
    const same = { ...withScheduled };
    expect(tripsAreEqual(withScheduled, same)).toBe(true);

    const different = {
      ...withScheduled,
      ScheduledTrip: { ...scheduled, Key: "st2" },
    };
    expect(tripsAreEqual(withScheduled, different)).toBe(false);
  });
});
