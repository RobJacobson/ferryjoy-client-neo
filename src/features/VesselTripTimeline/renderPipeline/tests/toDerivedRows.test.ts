import { describe, expect, it } from "bun:test";
import type { TimelinePipelineWithEvents } from "../../types";
import { toDerivedRows } from "../toDerivedRows";
import { toTimelineEvents } from "../toTimelineEvents";
import { at, makePipelineInput } from "./fixtures";

describe("toDerivedRows", () => {
  it("derives dock, sea, and dock rows from adjacent ordered events", () => {
    const withEvents = toTimelineEvents(makePipelineInput());
    const result = toDerivedRows(withEvents);

    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.kind)).toEqual([
      "at-dock",
      "at-sea",
      "at-dock",
    ]);
    expect(result.rows.map((row) => row.rowId)).toEqual([
      "WEN-row-0-at-dock",
      "WEN-row-1-at-sea",
      "WEN-row-2-at-dock",
    ]);
    expect(result.rows[0]?.geometryMinutes).toBe(23);
    expect(result.rows[1]?.geometryMinutes).toBe(30);
    expect(result.rows[2]?.geometryMinutes).toBe(30);
    expect(result.rows[1]?.progressMode).toBe("time");
  });

  it("uses distance progress for the sea row when telemetry distances are available", () => {
    const result = toDerivedRows(
      toTimelineEvents(
        makePipelineInput({
          vesselLocation: {
            DepartingDistance: 3.8,
            ArrivingDistance: 4.2,
          },
        })
      )
    );

    expect(result.rows[1]?.kind).toBe("at-sea");
    expect(result.rows[1]?.progressMode).toBe("distance");
  });

  it("falls back to route priors when boundary times are missing", () => {
    const base = toTimelineEvents(makePipelineInput());
    const input: TimelinePipelineWithEvents = {
      ...base,
      events: [
        {
          eventType: "arrive",
          terminalAbbrev: "P52",
          timePoint: {},
        },
        {
          eventType: "depart",
          terminalAbbrev: "P52",
          timePoint: {},
        },
        {
          eventType: "arrive",
          terminalAbbrev: "BBI",
          timePoint: {
            scheduled: at(8, 35),
          },
        },
        {
          eventType: "depart",
          terminalAbbrev: "BBI",
          timePoint: {},
        },
      ],
    };

    const result = toDerivedRows(input);

    expect(result.rows.map((row) => row.geometryMinutes)).toEqual([
      21.17, 32.8, 18.5,
    ]);
  });
});
