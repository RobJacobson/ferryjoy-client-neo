/**
 * Covers the active-row selection stage of the VesselTimeline pipeline.
 */

import { describe, expect, it } from "bun:test";
import { toActiveRow } from "../toActiveRow";
import { toDerivedRows } from "../toDerivedRows";
import { at, makeEvent, makePipelineInput } from "./fixtures";

describe("toActiveRow", () => {
  it("returns null when the backend provides no active interval", () => {
    const withRows = toDerivedRows(makePipelineInput({ activeInterval: null }));

    expect(toActiveRow(withRows).activeRow).toBeNull();
  });

  it("matches the active at-sea interval to the derived sea row", () => {
    const withRows = toDerivedRows(
      makePipelineInput({
        activeInterval: {
          kind: "at-sea",
          startEventKey: "trip-1--dep-dock",
          endEventKey: "trip-1--arv-dock",
        },
      })
    );

    const { activeRow } = toActiveRow(withRows);

    expect(activeRow?.row.rowId).toBe("trip-1--at-sea");
    expect(activeRow?.rowIndex).toBe(1);
  });

  it("returns null for an open-ended at-sea interval", () => {
    const withRows = toDerivedRows(
      makePipelineInput({
        activeInterval: {
          kind: "at-sea",
          startEventKey: "trip-1--dep-dock",
          endEventKey: null,
        },
      })
    );

    expect(toActiveRow(withRows).activeRow).toBeNull();
  });

  it("matches a normal at-dock interval by the departure event key", () => {
    const withRows = toDerivedRows(
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
            TerminalAbbrev: "VAI",
            EventScheduledTime: at(8, 35),
          }),
        ],
        activeInterval: {
          kind: "at-dock",
          startEventKey: "trip-0--arv-dock",
          endEventKey: "trip-1--dep-dock",
        },
      })
    );

    const { activeRow } = toActiveRow(withRows);

    expect(activeRow?.row.rowId).toBe("trip-1--at-dock");
    expect(activeRow?.rowIndex).toBe(0);
  });

  it("matches a post-arrival interval to the terminal-tail row", () => {
    const withRows = toDerivedRows(
      makePipelineInput({
        activeInterval: {
          kind: "at-dock",
          startEventKey: "trip-1--arv-dock",
          endEventKey: null,
        },
      })
    );

    const { activeRow } = toActiveRow(withRows);

    expect(activeRow?.row.rowId).toBe("trip-1--at-dock--terminal-tail");
    expect(activeRow?.rowIndex).toBe(2);
  });
});
