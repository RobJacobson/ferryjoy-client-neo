/**
 * Covers the row-derivation stage of the VesselTimeline render pipeline.
 */

import { describe, expect, it } from "bun:test";
import { toDerivedRows } from "../toDerivedRows";
import { at, makeEvent, makePipelineInput } from "./fixtures";

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

  it("ignores invalid non-adjacent seams instead of patching them into dock rows", () => {
    const { rows } = toDerivedRows(
      makePipelineInput({
        events: [
          makeEvent({
            SegmentKey: "trip-0",
            Key: "trip-0--arv-dock",
            EventType: "arv-dock",
            TerminalAbbrev: "BBI",
            ScheduledDeparture: at(7, 15),
            EventScheduledTime: at(7, 45),
          }),
          makeEvent({
            SegmentKey: "trip-1",
            Key: "trip-1--dep-dock",
            EventType: "dep-dock",
            TerminalAbbrev: "P52",
          }),
        ],
      })
    );

    expect(rows).toEqual([]);
  });

  it("derives one at-sea row per segment when each departure is adjacent to its arrival", () => {
    const { rows } = toDerivedRows(
      makePipelineInput({
        events: [
          makeEvent({
            SegmentKey: "trip-a",
            Key: "trip-a--dep-dock",
            EventType: "dep-dock",
            TerminalAbbrev: "VAI",
            ScheduledDeparture: at(8, 0),
            EventScheduledTime: at(8, 0),
          }),
          makeEvent({
            SegmentKey: "trip-a",
            Key: "trip-a--arv-dock",
            EventType: "arv-dock",
            TerminalAbbrev: "FAU",
            ScheduledDeparture: at(8, 0),
            EventScheduledTime: at(8, 10),
          }),
          makeEvent({
            SegmentKey: "trip-b",
            Key: "trip-b--dep-dock",
            EventType: "dep-dock",
            TerminalAbbrev: "FAU",
            ScheduledDeparture: at(8, 10),
            EventScheduledTime: at(8, 10),
          }),
          makeEvent({
            SegmentKey: "trip-b",
            Key: "trip-b--arv-dock",
            EventType: "arv-dock",
            TerminalAbbrev: "SOU",
            ScheduledDeparture: at(8, 10),
            EventScheduledTime: at(8, 40),
          }),
        ],
      })
    );

    const seaRows = rows.filter((row) => row.kind === "at-sea");
    expect(seaRows.map((row) => row.segmentKey)).toEqual(["trip-a", "trip-b"]);
    expect(seaRows[0]?.startEvent.Key).toBe("trip-a--dep-dock");
    expect(seaRows[0]?.endEvent.Key).toBe("trip-a--arv-dock");
  });
});
