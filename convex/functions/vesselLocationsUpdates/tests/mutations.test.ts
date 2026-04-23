/**
 * Unit tests for vessel-location updates combined upsert mutation.
 */

import { describe, expect, it } from "bun:test";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { bulkUpsertLocationsAndUpdates } from "functions/vesselLocationsUpdates/mutations";

type DbDoc = Record<string, unknown> & { _id: string; _creationTime: number };

type MockDb = {
  tables: Record<string, DbDoc[]>;
  query: (table: string) => {
    collect: () => Promise<DbDoc[]>;
    withIndex?: (
      _indexName: string,
      apply: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
    ) => { unique: () => Promise<DbDoc | null> };
  };
  replace: (id: string, value: Record<string, unknown>) => Promise<void>;
  insert: (table: string, value: Record<string, unknown>) => Promise<string>;
};

describe("vesselLocationsUpdates bulkUpsertLocationsAndUpdates", () => {
  it("writes changed locations and update signatures together", async () => {
    const db = createDb({
      vesselLocations: [
        withMeta("loc-1", {
          ...makeLocation({
            VesselAbbrev: "CHE",
            TimeStamp: 100,
          }),
        }),
      ],
      vesselLocationsUpdates: [
        withMeta("upd-1", {
          VesselAbbrev: "CHE",
          TimeStamp: 100,
          VesselLocationId: "loc-1",
        }),
      ],
    });

    await (
      bulkUpsertLocationsAndUpdates as unknown as {
        _handler: (
          ctx: { db: MockDb },
          args: { locations: Array<ConvexVesselLocation> }
        ) => Promise<null>;
      }
    )._handler(
      { db },
      {
        locations: [
          makeLocation({
            VesselAbbrev: "CHE",
            TimeStamp: 200,
          }),
          makeLocation({
            VesselAbbrev: "KIT",
            VesselID: 4,
            VesselName: "Kittywake",
            TimeStamp: 300,
          }),
        ],
      }
    );

    expect(db.tables.vesselLocations).toHaveLength(2);
    expect(db.tables.vesselLocationsUpdates).toHaveLength(2);
    expect(
      db.tables.vesselLocationsUpdates.find((row) => row.VesselAbbrev === "CHE")
        ?.TimeStamp
    ).toBe(200);
    expect(
      db.tables.vesselLocationsUpdates.find((row) => row.VesselAbbrev === "CHE")
        ?.VesselLocationId
    ).toBe("loc-1");
    expect(
      db.tables.vesselLocationsUpdates.find((row) => row.VesselAbbrev === "KIT")
        ?.TimeStamp
    ).toBe(300);
    expect(
      db.tables.vesselLocationsUpdates.find((row) => row.VesselAbbrev === "KIT")
        ?.VesselLocationId
    ).toBe("vesselLocations-2");
  });

  it("reuses existing vesselLocations row on cold start without updates rows", async () => {
    const db = createDb({
      vesselLocations: [
        withMeta("loc-1", {
          ...makeLocation({
            VesselAbbrev: "CHE",
            TimeStamp: 100,
          }),
        }),
      ],
      vesselLocationsUpdates: [],
    });

    await (
      bulkUpsertLocationsAndUpdates as unknown as {
        _handler: (
          ctx: { db: MockDb },
          args: { locations: Array<ConvexVesselLocation> }
        ) => Promise<null>;
      }
    )._handler(
      { db },
      {
        locations: [
          makeLocation({
            VesselAbbrev: "CHE",
            TimeStamp: 200,
          }),
        ],
      }
    );

    expect(db.tables.vesselLocations).toHaveLength(1);
    expect(db.tables.vesselLocationsUpdates).toHaveLength(1);
    expect(db.tables.vesselLocationsUpdates[0]?.VesselLocationId).toBe("loc-1");
    expect(db.tables.vesselLocations[0]?.TimeStamp).toBe(200);
  });
});

const createDb = (initial: Record<string, DbDoc[]>): MockDb => {
  const tables: Record<string, DbDoc[]> = {
    vesselLocations: [...(initial.vesselLocations ?? [])],
    vesselLocationsUpdates: [...(initial.vesselLocationsUpdates ?? [])],
  };

  return {
    tables,
    query: (table: string) => {
      const collect = async () => [...(tables[table] ?? [])];
      if (table === "vesselLocations") {
        return {
          collect,
          withIndex: (
            _indexName: string,
            apply: (q: {
              eq: (field: string, value: unknown) => unknown;
            }) => unknown
          ) => ({
            unique: async () => {
              const state: { field?: string; value?: unknown } = {};
              apply({
                eq: (field: string, value: unknown) => {
                  state.field = field;
                  state.value = value;
                  return {};
                },
              });
              return (
                [...(tables.vesselLocations ?? [])].find(
                  (row) =>
                    state.field !== undefined &&
                    row[state.field] === state.value
                ) ?? null
              );
            },
          }),
        };
      }
      return { collect };
    },
    replace: async (id: string, value: Record<string, unknown>) => {
      const tableName = Object.keys(tables).find((name) =>
        (tables[name] ?? []).some((row) => row._id === id)
      );
      if (!tableName) {
        throw new Error(`Missing row for replace id=${id}`);
      }
      tables[tableName] = (tables[tableName] ?? []).map((row) =>
        row._id === id ? withMeta(id, value, row._creationTime) : row
      );
    },
    insert: async (table: string, value: Record<string, unknown>) => {
      const rows = tables[table] ?? [];
      const id = `${table}-${rows.length + 1}`;
      tables[table] = [...rows, withMeta(id, value)];
      return id;
    },
  };
};

const withMeta = (
  id: string,
  row: Record<string, unknown>,
  creationTime = Date.now()
): DbDoc => ({
  _id: id,
  _creationTime: creationTime,
  ...row,
});

const makeLocation = (
  overrides: Partial<ConvexVesselLocation>
): ConvexVesselLocation => ({
  VesselID: 2,
  VesselName: "Chelan",
  VesselAbbrev: "CHE",
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
  RouteAbbrev: "ana-sj",
  VesselPositionNum: 1,
  TimeStamp: 100,
  ScheduleKey: "CHE--2026-03-13--05:30--ANA-ORI",
  DepartingDistance: 1,
  ArrivingDistance: 2,
  ...overrides,
});
