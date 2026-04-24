/**
 * Tests for the functions-layer vessel-location step.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as adapters from "adapters";
import { updateVesselLocations } from "functions/vesselOrchestrator/testing";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";

afterEach(() => {
  mock.restore();
});

describe("functions/vesselOrchestrator updateVesselLocations", () => {
  it("writes changed locations through the orchestrator persistence mutation", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    const mutationCalls: unknown[] = [];
    const ctx = {
      runQuery: async () => ({
        vesselsIdentity: [],
        terminalsIdentity: [],
        activeTrips: [],
        storedLocations: [],
      }),
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return args;
      },
    } as unknown as ActionCtx;

    const result = await updateVesselLocations(
      ctx,
      Date.now(),
      [{ VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" }],
      [
        {
          TerminalID: 1,
          TerminalName: "Anacortes",
          TerminalAbbrev: "ANA",
          Latitude: 48.507351,
          Longitude: -122.677,
        },
        {
          TerminalID: 15,
          TerminalName: "Orcas Island",
          TerminalAbbrev: "ORI",
          Latitude: 48.597313,
          Longitude: -122.92935,
        },
      ]
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.VesselAbbrev).toBe("CHE");
    expect(result[0]?.ScheduleKey).toBe("CHE--2026-03-13--05:30--ANA-ORI");
    expect(mutationCalls).toHaveLength(1);
    expect(
      (
        mutationCalls[0] as {
          changedLocations: Array<{
            vesselLocation: { VesselAbbrev: string };
          }>;
        }
      ).changedLocations[0]?.vesselLocation.VesselAbbrev
    ).toBe("CHE");
  });

  it("skips mutation when vessel timestamp has not changed", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    const mutationCalls: unknown[] = [];
    const ctx = {
      runQuery: async () => ({
        vesselsIdentity: [],
        terminalsIdentity: [],
        activeTrips: [],
        storedLocations: [makeStoredLocation("loc-1", "CHE", toEpochMs())],
      }),
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return args;
      },
    } as unknown as ActionCtx;

    const result = await updateVesselLocations(
      ctx,
      Date.now(),
      [{ VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" }],
      [
        {
          TerminalID: 1,
          TerminalName: "Anacortes",
          TerminalAbbrev: "ANA",
          Latitude: 48.507351,
          Longitude: -122.677,
        },
        {
          TerminalID: 15,
          TerminalName: "Orcas Island",
          TerminalAbbrev: "ORI",
          Latitude: 48.597313,
          Longitude: -122.92935,
        },
      ]
    );

    expect(result).toHaveLength(1);
    expect(mutationCalls).toHaveLength(0);
  });

  it("writes when a vessel is new to the stored location snapshot", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    const mutationCalls: unknown[] = [];
    const ctx = {
      runQuery: async () => ({
        vesselsIdentity: [],
        terminalsIdentity: [],
        activeTrips: [],
        storedLocations: [makeStoredLocation("loc-2", "KIT", toEpochMs())],
      }),
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return args;
      },
    } as unknown as ActionCtx;

    await updateVesselLocations(
      ctx,
      Date.now(),
      [{ VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" }],
      [
        {
          TerminalID: 1,
          TerminalName: "Anacortes",
          TerminalAbbrev: "ANA",
          Latitude: 48.507351,
          Longitude: -122.677,
        },
        {
          TerminalID: 15,
          TerminalName: "Orcas Island",
          TerminalAbbrev: "ORI",
          Latitude: 48.597313,
          Longitude: -122.92935,
        },
      ]
    );

    expect(mutationCalls).toHaveLength(1);
    expect(
      (
        mutationCalls[0] as {
          changedLocations: Array<{
            vesselLocation: { VesselAbbrev: string };
          }>;
        }
      ).changedLocations
    ).toHaveLength(1);
  });
});

/**
 * Minimal raw WSF row that normalizes cleanly through the shared locations concern.
 */
const makeRawLocation = () =>
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
    ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00"),
    OpRouteAbbrev: ["ana-sj"],
    VesselPositionNum: 1,
    TimeStamp: new Date("2026-03-31T12:00:00-07:00"),
  }) as unknown as WsfVesselLocation;

const makeStoredLocation = (
  id: string,
  vesselAbbrev: string,
  timeStamp: number
) => ({
  _id: id,
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: vesselAbbrev,
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
  ScheduledDeparture: new Date("2026-03-13T05:30:00-07:00").getTime(),
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: timeStamp,
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  DepartingDistance: 0,
  ArrivingDistance: undefined,
});

const toEpochMs = () => new Date("2026-03-31T12:00:00-07:00").getTime();
