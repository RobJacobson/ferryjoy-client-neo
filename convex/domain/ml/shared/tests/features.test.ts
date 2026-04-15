import { describe, expect, it } from "bun:test";
import { extractFeatures } from "../features";
import type { UnifiedTrip } from "../unifiedTrip";

describe("extractFeatures", () => {
  it("computes durations from canonical physical timestamps rather than legacy mirrors", () => {
    const trip = makeTrip();
    const features = extractFeatures(trip);

    expect(features.tripDelay).toBeCloseTo(15, 5);
    expect(features.atDockDuration).toBeCloseTo(15, 5);
    expect(features.atSeaDuration).toBeCloseTo(15, 5);
    expect(features.totalDuration).toBeCloseTo(65, 5);
    expect(features.slackBeforeDepartureMinutes).toBeCloseTo(0, 5);
    expect(features.arrivalAfterScheduledDepartureMinutes).toBeCloseTo(0, 5);
    expect(features.prevAtSeaDuration).toBeCloseTo(15, 5);
  });
});

const makeTrip = (): UnifiedTrip => {
  const base = ms("2026-04-14T10:00:00-07:00");
  return {
    VesselAbbrev: "CHE",
    PrevTerminalAbbrev: "ORI",
    DepartingTerminalAbbrev: "ANA",
    ArrivingTerminalAbbrev: "FRH",
    ArriveOriginDockActual: base + 30 * MINUTE,
    ArriveDestDockActual: base + 60 * MINUTE,
    DepartOriginActual: base + 45 * MINUTE,
    StartTime: base,
    EndTime: base + 65 * MINUTE,
    TripStart: base + 3 * HOUR,
    ScheduledDeparture: base + 30 * MINUTE,
    LeftDock: base + 2 * HOUR,
    TripEnd: base + 4 * HOUR,
    PrevLeftDock: base + 15 * MINUTE,
    PrevScheduledDeparture: base - 15 * MINUTE,
  };
};

const ms = (iso: string) => new Date(iso).getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
