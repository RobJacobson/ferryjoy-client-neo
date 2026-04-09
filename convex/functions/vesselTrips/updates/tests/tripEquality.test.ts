/**
 * Unit tests for lifecycle vs projection trip equality predicates.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  tripsEqualForOverlay,
  tripsEqualForStorage,
} from "../tripLifecycle/tripEquality";

const ms = (iso: string) => new Date(iso).getTime();

/**
 * Builds a minimal stored-shaped trip for equality tests.
 *
 * @param overrides - Field overrides
 * @returns Trip fixture
 */
const makeBaseTrip = (
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: "CHE",
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  Key: "CHE--2026-03-13--05:30--ANA-ORI",
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: true,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T04:33:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextKey: "CHE--2026-03-13--07:00--ORI-LOP",
  NextScheduledDeparture: ms("2026-03-13T07:00:00-07:00"),
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
  ...overrides,
});

/**
 * Builds a prediction blob with optional PredTime override.
 *
 * @param iso - PredTime ISO string
 * @returns Full ML-shaped prediction
 */
const makePrediction = (iso: string) => {
  const predTime = ms(iso);
  return {
    PredTime: predTime,
    MinTime: predTime - 60_000,
    MaxTime: predTime + 60_000,
    MAE: 2,
    StdDev: 1,
  };
};

describe("tripsEqualForStorage", () => {
  it("is true when only ML prediction blobs differ on stored-equivalent rows", () => {
    const existing = makeBaseTrip();
    const proposed = makeBaseTrip({
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
    });
    expect(tripsEqualForStorage(existing, proposed)).toBe(true);
  });

  it("is false when a non-prediction stored field differs", () => {
    const existing = makeBaseTrip();
    const proposed = makeBaseTrip({ TripDelay: 99 });
    expect(tripsEqualForStorage(existing, proposed)).toBe(false);
  });

  it("is true when only TimeStamp differs", () => {
    const existing = makeBaseTrip();
    const proposed = makeBaseTrip({
      TimeStamp: ms("2026-03-13T05:00:00-07:00"),
    });
    expect(tripsEqualForStorage(existing, proposed)).toBe(true);
  });
});

describe("tripsEqualForOverlay", () => {
  it("is false when normalized PredTime differs on a prediction field", () => {
    const existing = makeBaseTrip();
    const proposed = makeBaseTrip({
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
    });
    expect(tripsEqualForOverlay(existing, proposed)).toBe(false);
  });

  it("is true when only ML interval noise differs but PredTime matches", () => {
    const pred = makePrediction("2026-03-13T05:31:00-07:00");
    const existing = makeBaseTrip({
      AtDockDepartCurr: { ...pred, MAE: 1 },
    });
    const proposed = makeBaseTrip({
      AtDockDepartCurr: { ...pred, MAE: 99, MinTime: pred.MinTime + 1 },
    });
    expect(tripsEqualForOverlay(existing, proposed)).toBe(true);
  });
});

describe("storage vs overlay", () => {
  it("storage-equal but overlay-differing when only prediction semantics change", () => {
    const existing = makeBaseTrip();
    const proposed = makeBaseTrip({
      AtDockDepartCurr: makePrediction("2026-03-13T05:31:00-07:00"),
    });
    expect(tripsEqualForStorage(existing, proposed)).toBe(true);
    expect(tripsEqualForOverlay(existing, proposed)).toBe(false);
  });

  it("both false when a stored column changes", () => {
    const existing = makeBaseTrip();
    const proposed = makeBaseTrip({ TripDelay: 3 });
    expect(tripsEqualForStorage(existing, proposed)).toBe(false);
    expect(tripsEqualForOverlay(existing, proposed)).toBe(false);
  });
});
