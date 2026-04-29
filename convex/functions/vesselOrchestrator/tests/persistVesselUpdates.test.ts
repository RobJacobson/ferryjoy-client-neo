import { describe, expect, it } from "bun:test";
import type { MutationCtx } from "_generated/server";
import type { ConvexActualDockEvent } from "functions/events/eventsActual/schemas";
import type { ConvexPredictedDockWriteBatch } from "functions/events/eventsPredicted/schemas";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/physicalTripIdentity";
import { persistVesselUpdates } from "../mutations";

type PersistVesselUpdatesHandler = (
  ctx: MutationCtx,
  args: {
    vesselAbbrev: string;
    activeVesselTrip: ConvexVesselTrip;
    completedVesselTrip?: ConvexVesselTrip;
    predictionRows: VesselTripPredictionProposal[];
    actualEvents: ConvexActualDockEvent[];
    predictedEvents: ConvexPredictedDockWriteBatch[];
    departNextActualization?: {
      vesselAbbrev: string;
      depBoundaryKey: string;
      actualDepartMs: number;
    };
  }
) => Promise<null>;

const handler = (
  persistVesselUpdates as unknown as { _handler: PersistVesselUpdatesHandler }
)._handler;

const ms = (iso: string) => new Date(iso).getTime();

const makeTrip = (
  vesselAbbrev: string,
  overrides: Partial<ConvexVesselTrip> = {}
): ConvexVesselTrip => ({
  VesselAbbrev: vesselAbbrev,
  DepartingTerminalAbbrev: "ANA",
  ArrivingTerminalAbbrev: "ORI",
  RouteAbbrev: "ana-sj",
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
  SailingDay: "2026-03-13",
  PrevTerminalAbbrev: "ORI",
  ArriveDest: undefined,
  TripStart: ms("2026-03-13T04:33:00-07:00"),
  AtDock: false,
  AtDockDuration: undefined,
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  LeftDock: ms("2026-03-13T05:29:38-07:00"),
  LeftDockActual: ms("2026-03-13T05:29:38-07:00"),
  ArrivedCurrActual: ms("2026-03-13T04:33:00-07:00"),
  ArrivedNextActual: undefined,
  TripDelay: undefined,
  Eta: undefined,
  TripEnd: undefined,
  AtSeaDuration: undefined,
  TotalDuration: undefined,
  InService: true,
  TimeStamp: ms("2026-03-13T06:28:45-07:00"),
  PrevScheduledDeparture: ms("2026-03-12T19:30:00-07:00"),
  PrevLeftDock: ms("2026-03-12T19:34:26-07:00"),
  NextScheduleKey: undefined,
  NextScheduledDeparture: undefined,
  EndTime: undefined,
  StartTime: ms("2026-03-13T04:33:00-07:00"),
  AtDockActual: ms("2026-03-13T04:33:00-07:00"),
  ...overrides,
});

const makePrediction = (
  vesselAbbrev: string
): VesselTripPredictionProposal => ({
  VesselAbbrev: vesselAbbrev,
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  PredictionType: "AtDockDepartNext",
  prediction: {
    PredTime: ms("2026-03-13T05:35:00-07:00"),
    MinTime: ms("2026-03-13T05:30:00-07:00"),
    MaxTime: ms("2026-03-13T05:40:00-07:00"),
    MAE: 3,
    StdDev: 2,
  },
});

const makeActualEvent = (vesselAbbrev: string): ConvexActualDockEvent => ({
  TripKey: generateTripKey(vesselAbbrev, ms("2026-03-13T04:33:00-07:00")),
  ScheduleKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI`,
  VesselAbbrev: vesselAbbrev,
  SailingDay: "2026-03-13",
  ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
  TerminalAbbrev: "ANA",
  EventActualTime: ms("2026-03-13T05:29:38-07:00"),
  EventKey: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI--dep-dock`,
  EventType: "dep-dock",
  UpdatedAt: ms("2026-03-13T06:28:45-07:00"),
  EventOccurred: true,
});

const makePredictedBatch = (
  vesselAbbrev: string
): ConvexPredictedDockWriteBatch => ({
  VesselAbbrev: vesselAbbrev,
  SailingDay: "2026-03-13",
  TargetKeys: [`${vesselAbbrev}--2026-03-13--05:30--ANA-ORI--dep-dock`],
  Rows: [
    {
      Key: `${vesselAbbrev}--2026-03-13--05:30--ANA-ORI--dep-dock`,
      VesselAbbrev: vesselAbbrev,
      SailingDay: "2026-03-13",
      ScheduledDeparture: ms("2026-03-13T05:30:00-07:00"),
      TerminalAbbrev: "ANA",
      EventPredictedTime: ms("2026-03-13T05:33:00-07:00"),
      PredictionType: "AtDockDepartNext",
      PredictionSource: "ml",
    },
  ],
});

const makeCtx = (
  writes: string[],
  options: { failOnInsertTable?: string } = {}
): MutationCtx =>
  ({
    db: {
      query: (tableName: string) => ({
        withIndex: (indexName: string) => ({
          first: async () => {
            writes.push(`query:${tableName}.${indexName}.first`);
            return null;
          },
          unique: async () => {
            writes.push(`query:${tableName}.${indexName}.unique`);
            return null;
          },
          collect: async () => {
            writes.push(`query:${tableName}.${indexName}.collect`);
            return [];
          },
        }),
        collect: async () => {
          writes.push(`query:${tableName}.collect`);
          return [];
        },
      }),
      insert: async (tableName: string) => {
        writes.push(`insert:${tableName}`);
        if (options.failOnInsertTable === tableName) {
          throw new Error(`simulated ${tableName} insert failure`);
        }
        return `${tableName}-id`;
      },
      replace: async (id: string) => {
        writes.push(`replace:${id}`);
      },
      patch: async (id: string) => {
        writes.push(`patch:${id}`);
      },
      delete: async (id: string) => {
        writes.push(`delete:${id}`);
      },
    },
  }) as unknown as MutationCtx;

describe("persistVesselUpdates", () => {
  it("persists an active-only vessel update", async () => {
    const writes: string[] = [];

    await handler(makeCtx(writes), {
      vesselAbbrev: "CHE",
      activeVesselTrip: makeTrip("CHE"),
      predictionRows: [],
      actualEvents: [],
      predictedEvents: [],
    });

    expect(writes).toEqual([
      "query:activeVesselTrips.by_vessel_abbrev.first",
      "insert:activeVesselTrips",
    ]);
  });

  it("persists completed, active, prediction, timeline, and actualization writes in order", async () => {
    const writes: string[] = [];

    await handler(makeCtx(writes), {
      vesselAbbrev: "CHE",
      activeVesselTrip: makeTrip("CHE"),
      completedVesselTrip: makeTrip("CHE", {
        EndTime: ms("2026-03-13T06:28:45-07:00"),
      }),
      predictionRows: [makePrediction("CHE")],
      actualEvents: [makeActualEvent("CHE")],
      predictedEvents: [makePredictedBatch("CHE")],
      departNextActualization: {
        vesselAbbrev: "CHE",
        depBoundaryKey: "CHE--2026-03-13--05:30--ANA-ORI--dep-dock",
        actualDepartMs: ms("2026-03-13T05:29:38-07:00"),
      },
    });

    expect(writes).toEqual([
      "insert:completedVesselTrips",
      "query:activeVesselTrips.by_vessel_abbrev.first",
      "insert:activeVesselTrips",
      "query:vesselTripPredictions.by_vessel_trip_and_field.unique",
      "insert:vesselTripPredictions",
      "query:eventsActual.by_event_key.unique",
      "insert:eventsActual",
      "query:eventsPredicted.by_vessel_and_sailing_day.collect",
      "insert:eventsPredicted",
      "query:eventsPredicted.by_key_type_and_source.first",
      "query:eventsPredicted.by_key_type_and_source.first",
    ]);
  });

  it("rejects instead of swallowing persistence errors", async () => {
    const writes: string[] = [];

    await expect(
      handler(makeCtx(writes, { failOnInsertTable: "vesselTripPredictions" }), {
        vesselAbbrev: "CHE",
        activeVesselTrip: makeTrip("CHE"),
        predictionRows: [makePrediction("CHE")],
        actualEvents: [],
        predictedEvents: [],
      })
    ).rejects.toThrow("simulated vesselTripPredictions insert failure");
  });
});
