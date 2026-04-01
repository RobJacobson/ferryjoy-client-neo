import { describe, expect, it } from "bun:test";
import {
  TERMINALS_STORAGE_SCHEMA,
  TERMINALS_TOPOLOGY_STORAGE_SCHEMA,
  VESSELS_STORAGE_SCHEMA,
} from "../datasets";

describe("identity storage schemas", () => {
  it("accepts valid vessel snapshots", () => {
    expect(
      VESSELS_STORAGE_SCHEMA.safeParse([
        {
          VesselID: 1,
          VesselName: "Tacoma",
          VesselAbbrev: "TKM",
        },
      ]).success
    ).toBe(true);
  });

  it("rejects malformed vessel snapshots", () => {
    expect(
      VESSELS_STORAGE_SCHEMA.safeParse({
        VesselID: 1,
      }).success
    ).toBe(false);
  });

  it("accepts valid terminal snapshots", () => {
    expect(
      TERMINALS_STORAGE_SCHEMA.safeParse([
        {
          TerminalID: 10,
          TerminalName: "Seattle",
          TerminalAbbrev: "P52",
          Latitude: 47.602501,
          Longitude: -122.340472,
        },
      ]).success
    ).toBe(true);
  });

  it("rejects malformed terminal topology snapshots", () => {
    expect(
      TERMINALS_TOPOLOGY_STORAGE_SCHEMA.safeParse([
        {
          TerminalAbbrev: "P52",
          TerminalMates: "BBI",
          RouteAbbrevs: ["sea-bi"],
          RouteAbbrevsByArrivingTerminal: {
            BBI: ["sea-bi"],
          },
        },
      ]).success
    ).toBe(false);
  });
});
