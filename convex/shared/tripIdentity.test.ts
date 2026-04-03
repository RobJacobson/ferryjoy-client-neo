import { describe, expect, it } from "bun:test";
import { deriveTripIdentity } from "./tripIdentity";

describe("deriveTripIdentity", () => {
  it("derives key, sailing day, and trip readiness from complete inputs", () => {
    const identity = deriveTripIdentity({
      vesselAbbrev: "CHE",
      departingTerminalAbbrev: "ANA",
      arrivingTerminalAbbrev: "ORI",
      scheduledDepartureMs: ms("2026-03-13T05:30:00-07:00"),
    });

    expect(identity).toEqual({
      Key: "CHE--2026-03-13--05:30--ANA-ORI",
      SailingDay: "2026-03-13",
      isTripStartReady: true,
    });
  });

  it("omits key and trip readiness when arriving terminal is missing", () => {
    const identity = deriveTripIdentity({
      vesselAbbrev: "CHE",
      departingTerminalAbbrev: "ANA",
      arrivingTerminalAbbrev: undefined,
      scheduledDepartureMs: ms("2026-03-13T05:30:00-07:00"),
    });

    expect(identity.Key).toBeUndefined();
    expect(identity.SailingDay).toBe("2026-03-13");
    expect(identity.isTripStartReady).toBe(false);
  });

  it("omits key and sailing day when scheduled departure is missing", () => {
    const identity = deriveTripIdentity({
      vesselAbbrev: "CHE",
      departingTerminalAbbrev: "ANA",
      arrivingTerminalAbbrev: "ORI",
      scheduledDepartureMs: undefined,
    });

    expect(identity).toEqual({
      Key: undefined,
      SailingDay: undefined,
      isTripStartReady: false,
    });
  });

  it("keeps key local-date semantics while sailing day uses the 3am cutoff", () => {
    const identity = deriveTripIdentity({
      vesselAbbrev: "CHE",
      departingTerminalAbbrev: "ANA",
      arrivingTerminalAbbrev: "ORI",
      scheduledDepartureMs: ms("2026-03-14T02:30:00-07:00"),
    });

    expect(identity.Key).toBe("CHE--2026-03-14--02:30--ANA-ORI");
    expect(identity.SailingDay).toBe("2026-03-13");
    expect(identity.isTripStartReady).toBe(true);
  });
});

const ms = (iso: string) => new Date(iso).getTime();
