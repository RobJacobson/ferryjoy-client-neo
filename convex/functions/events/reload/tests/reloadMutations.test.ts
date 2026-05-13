/**
 * Internal mutation tests for unified dock-event reload persistence.
 */

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { MutationCtx } from "_generated/server";
import * as eventsActual from "functions/events/eventsActual/mutations";
import * as eventsScheduled from "functions/events/eventsScheduled/mutations";
import {
  type ReseedDockStatusEventsForSailingDayArgs,
  reseedDockEventsForSailingDay,
} from "../mutations";

type ReseedHandler = (
  ctx: MutationCtx,
  args: ReseedDockStatusEventsForSailingDayArgs
) => Promise<{ scheduledCount: number; actualCount: number }>;

afterEach(() => {
  mock.restore();
});

describe("reseedDockEventsForSailingDay", () => {
  it("delegates scheduled and actual persistence to the table helpers", async () => {
    const scheduledSpy = spyOn(
      eventsScheduled,
      "upsertScheduledRowsForSailingDay"
    ).mockResolvedValue(undefined);
    const actualSpy = spyOn(
      eventsActual,
      "replaceActualRowsForSailingDay"
    ).mockResolvedValue(undefined);
    const ctx = makeEmptyDbMutationCtx();

    const counts = await handler<ReseedHandler>(reseedDockEventsForSailingDay)(
      ctx,
      {
        SailingDay: "2026-04-10",
        Events: [],
      }
    );

    expect(counts).toEqual({ scheduledCount: 0, actualCount: 0 });
    expect(scheduledSpy).toHaveBeenCalledTimes(1);
    expect(scheduledSpy).toHaveBeenCalledWith(ctx, "2026-04-10", []);
    expect(actualSpy).toHaveBeenCalledTimes(1);
    expect(actualSpy).toHaveBeenCalledWith(ctx, "2026-04-10", [], {
      preserveAbsentTripKeys: new Set(),
    });
  });

  it("passes physical-only TripKeys through preserveAbsentTripKeys", async () => {
    const scheduledSpy = spyOn(
      eventsScheduled,
      "upsertScheduledRowsForSailingDay"
    ).mockResolvedValue(undefined);
    const actualSpy = spyOn(
      eventsActual,
      "replaceActualRowsForSailingDay"
    ).mockResolvedValue(undefined);
    const physicalOnlyActive = {
      VesselAbbrev: "WEN",
      TripKey: "phys-1",
      SailingDay: "2026-04-10",
      DepartingTerminalAbbrev: "P52",
      AtDock: false,
      InService: true,
      TimeStamp: 1,
    };
    const ctx = makeReloadMutationCtx({
      activeTrips: [physicalOnlyActive],
      completedTrips: [],
      vesselLocations: [],
    });

    await handler<ReseedHandler>(reseedDockEventsForSailingDay)(ctx, {
      SailingDay: "2026-04-10",
      Events: [],
    });

    expect(scheduledSpy).toHaveBeenCalledTimes(1);
    expect(actualSpy).toHaveBeenCalledTimes(1);
    expect(actualSpy.mock.calls[0]?.[3]).toEqual({
      preserveAbsentTripKeys: new Set(["phys-1"]),
    });
  });
});

/**
 * Reads a Convex test handler from an action or mutation reference.
 *
 * @param entrypoint - Convex function object exposed to tests
 * @returns Underlying handler with the requested type
 */
const handler = <Handler>(entrypoint: unknown): Handler =>
  (entrypoint as { _handler: Handler })._handler;

const makeReloadMutationCtx = (options: {
  activeTrips: unknown[];
  completedTrips: unknown[];
  vesselLocations: unknown[];
}): MutationCtx =>
  ({
    db: {
      query: (table: string) => {
        if (table === "vesselLocations") {
          return {
            collect: async () => options.vesselLocations,
          };
        }

        return {
          withIndex: () => ({
            collect: async () =>
              table === "activeVesselTrips"
                ? options.activeTrips
                : table === "completedVesselTrips"
                  ? options.completedTrips
                  : [],
          }),
          collect: async () => [],
        };
      },
    },
  }) as unknown as MutationCtx;

/**
 * Creates a MutationCtx mock whose table reads all return empty arrays.
 *
 * @returns Stub context for empty reload payload tests
 */
const makeEmptyDbMutationCtx = (): MutationCtx =>
  makeReloadMutationCtx({
    activeTrips: [],
    completedTrips: [],
    vesselLocations: [],
  });
