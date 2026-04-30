import { describe, expect, it } from "bun:test";
import { toTimelineEvents } from "../toTimelineEvents";
import {
  at,
  makePipelineInput,
  makePrediction,
  makeScheduledTrip,
} from "./fixtures";

describe("toTimelineEvents", () => {
  it("builds the ordered trip boundary events from the pipeline input", () => {
    const result = toTimelineEvents(makePipelineInput());

    expect(result.events).toHaveLength(4);
    expect(result.events.map((event) => event.eventType)).toEqual([
      "arrive",
      "depart",
      "arrive",
      "depart",
    ]);
    expect(result.events.map((event) => event.terminalAbbrev)).toEqual([
      "P52",
      "P52",
      "BBI",
      "BBI",
    ]);
    expect(result.events[0]?.timePoint.actual).toEqual(at(7, 42));
    expect(result.events[1]?.timePoint.estimated).toEqual(at(8, 5));
    expect(result.events[2]?.timePoint.estimated).toEqual(at(8, 35));
    expect(result.events[3]?.timePoint.estimated).toEqual(at(9, 5));
  });

  it("keeps the existing actual, estimated, and scheduled precedence rules", () => {
    const result = toTimelineEvents(
      makePipelineInput({
        trip: {
          LeftDock: at(8, 4),
          TripEnd: at(8, 36),
          AtSeaArriveNext: makePrediction({ PredTime: at(8, 39) }),
          AtDockArriveNext: makePrediction({ PredTime: at(8, 41) }),
          AtDockDepartNext: makePrediction({ PredTime: at(9, 3) }),
          AtSeaDepartNext: makePrediction({ PredTime: at(9, 7) }),
          ScheduledTrip: makeScheduledTrip({
            DepartingTime: at(8, 1),
            SchedArriveNext: at(8, 34),
            NextDepartingTime: at(8, 58),
          }),
        },
        vesselLocation: {
          LeftDock: at(8, 2),
          Eta: at(8, 33),
          ScheduledDeparture: at(8, 6),
        },
      })
    );

    expect(result.events[1]?.timePoint.actual).toEqual(at(8, 2));
    expect(result.events[1]?.timePoint.scheduled).toEqual(at(8, 1));
    expect(result.events[2]?.timePoint.actual).toEqual(at(8, 36));
    expect(result.events[2]?.timePoint.estimated).toEqual(at(8, 33));
    expect(result.events[2]?.timePoint.scheduled).toEqual(at(8, 34));
    expect(result.events[3]?.timePoint.estimated).toEqual(at(9, 3));
    expect(result.events[3]?.timePoint.scheduled).toEqual(at(8, 58));
  });
});
