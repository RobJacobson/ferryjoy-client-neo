import { describe, expect, it } from "bun:test";
import { extractFeatures } from "./features";
import type { UnifiedTrip } from "./unifiedTrip";

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (overrides: Partial<UnifiedTrip> = {}): UnifiedTrip => ({
  VesselAbbrev: "CHE",
  PrevTerminalAbbrev: "FAU",
  DepartingTerminalAbbrev: "SOU",
  ArrivingTerminalAbbrev: "VAI",
  TripStart: ms("2026-03-13T09:30:00-07:00"),
  TripEnd: ms("2026-03-13T11:05:00-07:00"),
  OriginArrivalActual: ms("2026-03-13T09:30:00-07:00"),
  DestinationArrivalActual: ms("2026-03-13T11:05:00-07:00"),
  LeftDockActual: ms("2026-03-13T10:05:00-07:00"),
  ScheduledDeparture: ms("2026-03-13T10:00:00-07:00"),
  LeftDock: ms("2026-03-13T10:45:00-07:00"),
  PrevLeftDock: ms("2026-03-13T08:20:00-07:00"),
  PrevScheduledDeparture: ms("2026-03-13T08:00:00-07:00"),
  ...overrides,
});

describe("extractFeatures", () => {
  it("uses canonical physical boundaries instead of legacy timing aliases", () => {
    const canonical = makeTrip();
    const noisyLegacyAliases = makeTrip({
      TripStart: ms("2026-03-13T06:10:00-07:00"),
      TripEnd: ms("2026-03-13T13:45:00-07:00"),
      LeftDock: ms("2026-03-13T10:50:00-07:00"),
      OriginArrivalActual: ms("2026-03-13T09:30:00-07:00"),
      DestinationArrivalActual: ms("2026-03-13T11:05:00-07:00"),
    });

    const canonicalFeatures = extractFeatures(canonical);
    const noisyFeatures = extractFeatures(noisyLegacyAliases);

    expect(canonicalFeatures.tripDelay).toBe(5);
    expect(canonicalFeatures.atDockDuration).toBe(35);
    expect(canonicalFeatures.atSeaDuration).toBe(60);
    expect(canonicalFeatures.totalDuration).toBe(95);
    expect(canonicalFeatures.slackBeforeDepartureMinutes).toBe(30);
    expect(canonicalFeatures.arrivalAfterScheduledDepartureMinutes).toBe(0);
    expect(canonicalFeatures.prevAtSeaDuration).toBe(70);

    expect(noisyFeatures.tripDelay).toBe(canonicalFeatures.tripDelay);
    expect(noisyFeatures.atDockDuration).toBe(canonicalFeatures.atDockDuration);
    expect(noisyFeatures.atSeaDuration).toBe(canonicalFeatures.atSeaDuration);
    expect(noisyFeatures.totalDuration).toBe(canonicalFeatures.totalDuration);
    expect(noisyFeatures.slackBeforeDepartureMinutes).toBe(
      canonicalFeatures.slackBeforeDepartureMinutes
    );
    expect(noisyFeatures.arrivalAfterScheduledDepartureMinutes).toBe(
      canonicalFeatures.arrivalAfterScheduledDepartureMinutes
    );
    expect(noisyFeatures.prevAtSeaDuration).toBe(
      canonicalFeatures.prevAtSeaDuration
    );
  });
});
