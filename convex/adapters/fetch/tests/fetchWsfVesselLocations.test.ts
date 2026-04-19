/**
 * Tests for the raw WSF vessel-location transport adapter.
 */

import { afterEach, describe, expect, it, mock } from "bun:test";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import * as wsfCore from "ws-dottie/wsf-vessels/core";

afterEach(() => {
  mock.restore();
});

describe("fetchRawWsfVesselLocations", () => {
  it("returns the raw rows from the WSF transport unchanged", async () => {
    const rows = [makeRawLocation({ VesselID: 101 })];
    mock.module("ws-dottie/wsf-vessels/core", () => ({
      ...wsfCore,
      fetchVesselLocations: async () => rows,
    }));

    const { fetchRawWsfVesselLocations } = await import(
      "../fetchWsfVesselLocations"
    );
    const result = await fetchRawWsfVesselLocations();

    expect(result).toEqual(rows);
  });

  it("throws when the WSF transport returns no rows", async () => {
    mock.module("ws-dottie/wsf-vessels/core", () => ({
      ...wsfCore,
      fetchVesselLocations: async () => [],
    }));

    const { fetchRawWsfVesselLocations } = await import(
      "../fetchWsfVesselLocations"
    );
    await expect(fetchRawWsfVesselLocations()).rejects.toThrow(
      /No vessel locations received from WSF API/
    );
  });
});

const makeRawLocation = (
  overrides: Partial<DottieVesselLocation>
): DottieVesselLocation =>
  ({
    VesselID: 2,
    VesselName: "Chelan",
    DepartingTerminalID: 1,
    DepartingTerminalName: "Anacortes",
    DepartingTerminalAbbrev: "ANA",
    ArrivingTerminalID: 15,
    ArrivingTerminalName: "Orcas Island",
    ArrivingTerminalAbbrev: "ORI",
    Latitude: 48.5,
    Longitude: -122.6,
    Speed: 12,
    Heading: 180,
    InService: true,
    AtDock: false,
    LeftDock: undefined,
    Eta: undefined,
    ScheduledDeparture: undefined,
    OpRouteAbbrev: ["ana-sj"],
    VesselPositionNum: 1,
    TimeStamp: new Date("2026-03-31T12:00:00-07:00"),
    ...overrides,
  }) as DottieVesselLocation;
