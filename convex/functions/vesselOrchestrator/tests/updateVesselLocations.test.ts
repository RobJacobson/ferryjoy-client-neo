/**
 * Tests location-stage behavior through the orchestrator entrypoint.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { ActionCtx } from "_generated/server";
import * as adapters from "adapters";
import type { VesselLocation as WsfVesselLocation } from "ws-dottie/wsf-vessels/core";
import { updateVesselOrchestrator } from "../action";

type InternalActionHandler = (
  ctx: ActionCtx,
  args: Record<string, never>
) => Promise<null>;

afterEach(() => {
  mock.restore();
});

describe("functions/vesselOrchestrator updateVesselOrchestrator location stage", () => {
  it("writes normalized locations through bulk-upsert via action entrypoint", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
    ]);

    const mutationCalls: unknown[] = [];
    const ctx = {
      runQuery: async () => ({
        vesselsIdentity: [
          { VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" },
        ],
        terminalsIdentity: [
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
        ],
        activeTrips: [],
      }),
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return [];
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    expect(mutationCalls).toHaveLength(1);
    const firstCall = mutationCalls[0] as {
      locations: Array<{
        VesselAbbrev: string;
        ScheduleKey?: string;
      }>;
    };
    expect(firstCall.locations).toHaveLength(1);
    expect(firstCall.locations[0]?.VesselAbbrev).toBe("CHE");
    expect(firstCall.locations[0]?.ScheduleKey).toBe(
      "CHE--2026-03-13--05:30--ANA-ORI"
    );
  });

  it("passes the full normalized feed batch into bulk-upsert", async () => {
    spyOn(adapters, "fetchRawWsfVesselLocations").mockResolvedValue([
      makeRawLocation(),
      makeRawLocation({
        VesselID: 3,
        VesselName: "Tacoma",
        TimeStamp: new Date("2026-03-31T12:00:05-07:00"),
      }),
    ]);

    const mutationCalls: unknown[] = [];
    const ctx = {
      runQuery: async () => ({
        vesselsIdentity: [
          { VesselID: 2, VesselName: "Chelan", VesselAbbrev: "CHE" },
          { VesselID: 3, VesselName: "Tacoma", VesselAbbrev: "TAC" },
        ],
        terminalsIdentity: [
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
        ],
        activeTrips: [],
      }),
      runMutation: async (_mutation: unknown, args: unknown) => {
        mutationCalls.push(args);
        return [];
      },
    } as unknown as ActionCtx;

    await (
      updateVesselOrchestrator as unknown as { _handler: InternalActionHandler }
    )._handler(ctx, {});

    expect(mutationCalls).toHaveLength(1);
    const firstCall = mutationCalls[0] as { locations: unknown[] };
    expect(firstCall.locations).toHaveLength(2);
  });
});

/**
 * Minimal raw WSF row that normalizes cleanly through the shared locations concern.
 */
const makeRawLocation = (overrides: Partial<WsfVesselLocation> = {}) =>
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
    ...overrides,
  }) as unknown as WsfVesselLocation;
