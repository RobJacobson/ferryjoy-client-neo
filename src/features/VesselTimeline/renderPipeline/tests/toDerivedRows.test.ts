/**
 * Covers the row-derivation stage of the VesselTimeline render pipeline.
 */

import { describe, expect, it } from "bun:test";
import { at, makeEvent, makePipelineInput } from "./fixtures";
import { toDerivedRows } from "../toDerivedRows";

describe("toDerivedRows", () => {
  it("derives dock, sea, and terminal-tail rows from ordered events", () => {
    const { rows } = toDerivedRows(
      makePipelineInput({
        events: [
          makeEvent({
            SegmentKey: "trip-1",
            Key: "trip-1--dep-dock",
            EventType: "dep-dock",
            TerminalAbbrev: "P52",
          }),
          makeEvent({
            SegmentKey: "trip-1",
            Key: "trip-1--arv-dock",
            EventType: "arv-dock",
            TerminalAbbrev: "VAI",
            EventScheduledTime: at(8, 35),
          }),
        ],
      })
    );

    expect(rows.map((row) => row.rowId)).toEqual([
      "trip-1--at-dock",
      "trip-1--at-sea",
      "trip-1--at-dock--terminal-tail",
    ]);
    expect(rows[0]?.placeholderReason).toBe("start-of-day");
    expect(rows[2]?.rowEdge).toBe("terminal-tail");
  });

  it("derives a normal dock row when a matching arrival precedes departure", () => {
    const { rows } = toDerivedRows(
      makePipelineInput({
        events: [
          makeEvent({
            SegmentKey: "trip-0",
            Key: "trip-0--arv-dock",
            EventType: "arv-dock",
            TerminalAbbrev: "P52",
            ScheduledDeparture: at(7, 15),
            EventScheduledTime: at(7, 45),
          }),
          makeEvent({
            SegmentKey: "trip-1",
            Key: "trip-1--dep-dock",
            EventType: "dep-dock",
            TerminalAbbrev: "P52",
          }),
          makeEvent({
            SegmentKey: "trip-1",
            Key: "trip-1--arv-dock",
            EventType: "arv-dock",
            TerminalAbbrev: "BBI",
            EventScheduledTime: at(8, 35),
          }),
        ],
      })
    );

    expect(rows[0]?.placeholderReason).toBeUndefined();
    expect(rows[0]?.startEvent.Key).toBe("trip-0--arv-dock");
  });
});
