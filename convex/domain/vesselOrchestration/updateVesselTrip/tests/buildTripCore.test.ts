import { describe, expect, it, spyOn } from "bun:test";
import { attachNextScheduledTripFields } from "domain/vesselOrchestration/updateVesselTrip/scheduleEnrichment";
import {
  buildBasicUpdatedVesselRows,
  buildUpdatedVesselRows,
} from "domain/vesselOrchestration/updateVesselTrip/tripBuilders";
import { resolveTripScheduleFields } from "domain/vesselOrchestration/updateVesselTrip/tripFields";
import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/updateVesselTrip/tripLifecycle";
import {
  makeLocation,
  makeScheduledSegment,
  makeScheduledTables,
  makeTerminalIdentity,
  makeTrip,
  ms,
} from "../tripFields/tests/testHelpers";

type DetectedTripEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

const continuingEvents = (
  overrides: Partial<DetectedTripEvents> = {}
): DetectedTripEvents => ({
  isCompletedTrip: false,
  didJustArriveAtDock: false,
  didJustLeaveDock: false,
  leftDockTime: undefined,
  scheduleKeyChanged: false,
  ...overrides,
});

const buildActiveTrip = ({
  vesselLocation,
  existingActiveTrip,
  events = continuingEvents(),
  scheduleTables = makeScheduledTables(),
}: {
  vesselLocation: Parameters<
    typeof buildUpdatedVesselRows
  >[0]["vesselLocation"];
  existingActiveTrip?: Parameters<
    typeof buildUpdatedVesselRows
  >[0]["existingActiveTrip"];
  events?: DetectedTripEvents;
  scheduleTables?: Parameters<typeof buildUpdatedVesselRows>[1];
}) =>
  buildUpdatedVesselRows(
    {
      vesselLocation,
      existingActiveTrip,
      events,
    },
    scheduleTables
  ).then((result) => result.activeVesselTrip);

describe("buildUpdatedVesselRows", () => {
  it("builds a basic active trip row without schedule access", () => {
    const existingTrip = makeTrip({
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });

    const tripRows = buildBasicUpdatedVesselRows({
      vesselLocation: makeLocation({
        TimeStamp: ms("2026-03-13T11:12:00-07:00"),
      }),
      existingActiveTrip: existingTrip,
      events: continuingEvents(),
    });

    expect(tripRows.completedVesselTrip).toBeUndefined();
    expect(tripRows.activeVesselTrip?.TripKey).toBe(existingTrip.TripKey);
    expect(tripRows.activeVesselTrip?.NextScheduleKey).toBe(
      existingTrip.NextScheduleKey
    );
  });

  it("builds basic completed and replacement active rows without schedule access", () => {
    const existingTrip = makeTrip({
      AtDock: false,
      LeftDock: ms("2026-03-13T11:02:00-07:00"),
      LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
    });

    const tripRows = buildBasicUpdatedVesselRows({
      vesselLocation: makeLocation({
        AtDock: true,
        DepartingTerminalAbbrev: "MUK",
        TimeStamp: ms("2026-03-13T11:28:00-07:00"),
      }),
      existingActiveTrip: existingTrip,
      events: continuingEvents({
        isCompletedTrip: true,
        didJustArriveAtDock: true,
      }),
    });

    expect(tripRows.completedVesselTrip?.TripEnd).toBe(
      ms("2026-03-13T11:28:00-07:00")
    );
    expect(tripRows.activeVesselTrip?.DepartingTerminalAbbrev).toBe("MUK");
    expect(tripRows.activeVesselTrip?.ArrivedCurrActual).toBe(
      ms("2026-03-13T11:28:00-07:00")
    );
  });

  it("keeps inferred trip fields stable while WSF remains incomplete", async () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });

    const trip = await buildActiveTrip({
      vesselLocation: makeLocation({
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
      }),
      existingActiveTrip: existingTrip,
    });

    expect(trip?.ArrivingTerminalAbbrev).toBe(
      existingTrip.ArrivingTerminalAbbrev
    );
    expect(trip?.ScheduledDeparture).toBe(existingTrip.ScheduledDeparture);
    expect(trip?.ScheduleKey).toBe(existingTrip.ScheduleKey);
  });

  it("replaces inferred fields immediately when WSF provides authoritative values", async () => {
    const existingTrip = makeTrip({
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
    });

    const trip = await buildActiveTrip({
      vesselLocation: makeLocation({
        ArrivingTerminalAbbrev: "SHI",
        ScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
        ScheduleKey: undefined,
      }),
      existingActiveTrip: existingTrip,
      events: continuingEvents({
        scheduleKeyChanged: true,
      }),
    });

    expect(trip?.ArrivingTerminalAbbrev).toBe("SHI");
    expect(trip?.ScheduledDeparture).toBe(ms("2026-03-13T12:30:00-07:00"));
    expect(trip?.ScheduleKey).toBe("CHE--2026-03-13--12:30--CLI-SHI");
  });

  it("starts the replacement trip with inferred fields after a completed arrival", async () => {
    const completedTrip = makeTrip({
      AtDock: true,
      LeftDock: ms("2026-03-13T10:00:00-07:00"),
      LeftDockActual: ms("2026-03-13T10:00:00-07:00"),
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--CLI-MUK",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });

    const tripRows = await buildUpdatedVesselRows(
      {
        vesselLocation: makeLocation({
          DepartingTerminalAbbrev: "MUK",
          DepartingTerminalName: "Mukilteo",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
        }),
        existingActiveTrip: completedTrip,
        events: continuingEvents({
          isCompletedTrip: true,
          didJustArriveAtDock: true,
          scheduleKeyChanged: true,
        }),
      },
      makeScheduledTables({
        segments: [nextSegment],
      })
    );

    expect(tripRows.activeVesselTrip?.ArrivingTerminalAbbrev).toBe("CLI");
    expect(tripRows.activeVesselTrip?.ScheduledDeparture).toBe(
      nextSegment.DepartingTime
    );
    expect(tripRows.activeVesselTrip?.ScheduleKey).toBe(nextSegment.Key);
    expect(tripRows.activeVesselTrip?.NextScheduleKey).toBe(
      nextSegment.NextKey
    );
  });

  it("does not reuse the completed leg schedule fields for a replacement trip", async () => {
    const completedTrip = makeTrip({
      AtDock: true,
      LeftDock: ms("2026-03-13T10:00:00-07:00"),
      LeftDockActual: ms("2026-03-13T10:00:00-07:00"),
      ArrivingTerminalAbbrev: "MUK",
      ScheduledDeparture: ms("2026-03-13T11:00:00-07:00"),
      ScheduleKey: "CHE--2026-03-13--11:00--CLI-MUK",
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--CLI-MUK",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });

    const tripRows = await buildUpdatedVesselRows(
      {
        vesselLocation: makeLocation({
          DepartingTerminalAbbrev: "MUK",
          DepartingTerminalName: "Mukilteo",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
        }),
        existingActiveTrip: completedTrip,
        events: continuingEvents({
          isCompletedTrip: true,
          didJustArriveAtDock: true,
          scheduleKeyChanged: true,
        }),
      },
      makeScheduledTables({
        segments: [nextSegment],
      })
    );

    expect(tripRows.completedVesselTrip?.ScheduleKey).toBe(
      completedTrip.ScheduleKey
    );
    expect(tripRows.activeVesselTrip?.ArrivingTerminalAbbrev).toBe("CLI");
    expect(tripRows.activeVesselTrip?.ScheduledDeparture).toBe(
      nextSegment.DepartingTime
    );
    expect(tripRows.activeVesselTrip?.ScheduleKey).toBe(nextSegment.Key);
  });

  it("keeps physical arrival behavior without schedule lookup on continuing updates", async () => {
    const existingTrip = makeTrip({
      AtDock: false,
      LeftDock: ms("2026-03-13T11:02:00-07:00"),
      LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
      ArriveDest: undefined,
      EndTime: undefined,
      StartTime: ms("2026-03-13T10:30:00-07:00"),
      TripStart: ms("2026-03-13T10:30:00-07:00"),
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      NextScheduleKey: "CHE--2026-03-13--12:30--MUK-CLI",
      NextScheduledDeparture: ms("2026-03-13T12:30:00-07:00"),
    });
    let scheduleReadCount = 0;

    const trip = await buildActiveTrip({
      vesselLocation: makeLocation({
        AtDock: true,
        LeftDock: existingTrip.LeftDock,
        DepartingTerminalAbbrev: "MUK",
        DepartingTerminalName: "Mukilteo",
        ArrivingTerminalAbbrev: undefined,
        ScheduledDeparture: undefined,
        ScheduleKey: undefined,
        TimeStamp: ms("2026-03-13T11:28:00-07:00"),
      }),
      existingActiveTrip: existingTrip,
      events: continuingEvents({
        didJustArriveAtDock: true,
      }),
      scheduleTables: {
        getTerminalIdentity: async () => {
          scheduleReadCount += 1;
          return makeTerminalIdentity("MUK");
        },
        getScheduledDepartureEvent: async () => {
          scheduleReadCount += 1;
          return null;
        },
        getScheduledDockEvents: async () => {
          scheduleReadCount += 1;
          return [];
        },
      },
    });

    expect(scheduleReadCount).toBe(0);
    expect(trip?.ArrivingTerminalAbbrev).toBeUndefined();
    expect(trip?.ScheduledDeparture).toBeUndefined();
    expect(trip?.ScheduleKey).toBeUndefined();
    expect(trip?.ArriveDest).toBe(ms("2026-03-13T11:28:00-07:00"));
  });

  it("keeps tripFieldInferenceMethod transient on persisted trip rows", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
    });

    const location = makeLocation({
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
    });
    const existingTrip = makeTrip({
      NextScheduleKey: nextSegment.Key,
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
    });
    const resolution = await resolveTripScheduleFields({
      location,
      existingTrip,
      scheduleAccess: makeScheduledTables({
        segments: [nextSegment],
      }),
    });
    const trip = attachNextScheduledTripFields({
      baseTrip: makeTrip({
        ArrivingTerminalAbbrev: resolution.current.ArrivingTerminalAbbrev,
        ScheduledDeparture: resolution.current.ScheduledDeparture,
        ScheduleKey: resolution.current.ScheduleKey,
        SailingDay: resolution.current.SailingDay,
        NextScheduleKey: undefined,
        NextScheduledDeparture: undefined,
      }),
      existingTrip,
      next: resolution.next,
    });

    expect(trip.ScheduleKey).toBe(nextSegment.Key);
    expect("tripFieldInferenceMethod" in trip).toBe(false);
  });

  it("persists inferred SailingDay as part of the resolved trip-field contract", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--CLI-MUK",
      SailingDay: "2026-03-14",
      DepartingTime: ms("2026-03-14T01:30:00-07:00"),
    });

    const tripRows = await buildUpdatedVesselRows(
      {
        vesselLocation: makeLocation({
          DepartingTerminalAbbrev: "CLI",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
        }),
        existingActiveTrip: makeTrip({
          AtDock: false,
          LeftDock: ms("2026-03-13T11:02:00-07:00"),
          LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
          NextScheduleKey: nextSegment.Key,
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
        }),
        events: continuingEvents({
          isCompletedTrip: true,
          didJustArriveAtDock: true,
          scheduleKeyChanged: true,
        }),
      },
      makeScheduledTables({
        segments: [nextSegment],
      })
    );

    const trip = tripRows.activeVesselTrip;

    expect(trip?.ScheduleKey).toBe(nextSegment.Key);
    expect(trip?.SailingDay).toBe(nextSegment.SailingDay);
  });

  it("does not look up schedule or warn on continuing updates with missing trip fields", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    let scheduleReadCount = 0;

    try {
      const trip = await buildActiveTrip({
        vesselLocation: makeLocation({
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
        }),
        existingActiveTrip: makeTrip({
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
        }),
        scheduleTables: {
          getTerminalIdentity: async () => {
            scheduleReadCount += 1;
            return makeTerminalIdentity("CLI");
          },
          getScheduledDepartureEvent: async () => {
            scheduleReadCount += 1;
            return null;
          },
          getScheduledDockEvents: async () => {
            scheduleReadCount += 1;
            return [];
          },
        },
      });

      expect(trip).toBeDefined();
      expect(scheduleReadCount).toBe(0);
      expect(warnSpy).not.toHaveBeenCalledWith(
        "[TripFields] schedule inference unavailable",
        expect.anything()
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("looks up schedule once and warns once when a passenger-terminal new trip has no schedule match", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    let scheduledDockEventReadCount = 0;

    try {
      await buildUpdatedVesselRows(
        {
          vesselLocation: makeLocation({
            DepartingTerminalAbbrev: "MUK",
            DepartingTerminalName: "Mukilteo",
            ArrivingTerminalAbbrev: undefined,
            ScheduledDeparture: undefined,
            ScheduleKey: undefined,
          }),
          existingActiveTrip: makeTrip({
            AtDock: false,
            LeftDock: ms("2026-03-13T11:02:00-07:00"),
            LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
            ArrivingTerminalAbbrev: undefined,
            ScheduledDeparture: undefined,
            ScheduleKey: undefined,
            NextScheduleKey: undefined,
          }),
          events: continuingEvents({
            isCompletedTrip: true,
            didJustArriveAtDock: true,
            scheduleKeyChanged: true,
          }),
        },
        {
          getTerminalIdentity: async () => makeTerminalIdentity("MUK"),
          getScheduledDepartureEvent: async () => null,
          getScheduledDockEvents: async () => {
            scheduledDockEventReadCount += 1;
            return [];
          },
        }
      );

      expect(scheduledDockEventReadCount).toBe(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        "[TripFields] schedule inference unavailable",
        expect.objectContaining({
          vesselAbbrev: "CHE",
          departingTerminalAbbrev: "MUK",
        })
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("skips schedule lookup for a new trip when the vessel is out of service", async () => {
    let scheduleReadCount = 0;

    const tripRows = await buildUpdatedVesselRows(
      {
        vesselLocation: makeLocation({
          InService: false,
          DepartingTerminalAbbrev: "MUK",
          DepartingTerminalName: "Mukilteo",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
        }),
        existingActiveTrip: makeTrip({
          AtDock: false,
          LeftDock: ms("2026-03-13T11:02:00-07:00"),
          LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
        }),
        events: continuingEvents({
          isCompletedTrip: true,
          didJustArriveAtDock: true,
          scheduleKeyChanged: true,
        }),
      },
      {
        getTerminalIdentity: async () => {
          scheduleReadCount += 1;
          return makeTerminalIdentity("MUK");
        },
        getScheduledDepartureEvent: async () => {
          scheduleReadCount += 1;
          return null;
        },
        getScheduledDockEvents: async () => {
          scheduleReadCount += 1;
          return [];
        },
      }
    );

    expect(scheduleReadCount).toBe(0);
    expect(tripRows.completedVesselTrip).toBeDefined();
    expect(tripRows.activeVesselTrip).toBeDefined();
  });

  it("skips schedule lookup for a new trip at a non-passenger terminal", async () => {
    let scheduledEventReadCount = 0;

    const tripRows = await buildUpdatedVesselRows(
      {
        vesselLocation: makeLocation({
          DepartingTerminalAbbrev: "VIG",
          DepartingTerminalName: "Vigor Shipyard",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
        }),
        existingActiveTrip: makeTrip({
          AtDock: false,
          LeftDock: ms("2026-03-13T11:02:00-07:00"),
          LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
        }),
        events: continuingEvents({
          isCompletedTrip: true,
          didJustArriveAtDock: true,
          scheduleKeyChanged: true,
        }),
      },
      {
        getTerminalIdentity: async () =>
          makeTerminalIdentity("VIG", { IsPassengerTerminal: false }),
        getScheduledDepartureEvent: async () => {
          scheduledEventReadCount += 1;
          return null;
        },
        getScheduledDockEvents: async () => {
          scheduledEventReadCount += 1;
          return [];
        },
      }
    );

    expect(scheduledEventReadCount).toBe(0);
    expect(tripRows.completedVesselTrip).toBeDefined();
    expect(tripRows.activeVesselTrip).toBeDefined();
  });

  it("handles provisional inference, authoritative WSF takeover, and then skips an unchanged ping", async () => {
    const nextSegment = makeScheduledSegment({
      Key: "CHE--2026-03-13--12:30--MUK-CLI",
      DepartingTerminalAbbrev: "MUK",
      ArrivingTerminalAbbrev: "CLI",
      DepartingTime: ms("2026-03-13T12:30:00-07:00"),
      NextKey: "CHE--2026-03-13--14:00--CLI-MUK",
      NextDepartingTime: ms("2026-03-13T14:00:00-07:00"),
    });
    const scheduleTables = makeScheduledTables({
      segments: [nextSegment],
    });
    const existingTrip = makeTrip({
      AtDock: false,
      LeftDock: ms("2026-03-13T11:02:00-07:00"),
      LeftDockActual: ms("2026-03-13T11:02:00-07:00"),
      DepartingTerminalAbbrev: "CLI",
      ArrivingTerminalAbbrev: undefined,
      ScheduledDeparture: undefined,
      ScheduleKey: undefined,
      NextScheduleKey: nextSegment.Key,
      NextScheduledDeparture: nextSegment.DepartingTime,
    });

    const inferredRows = await buildUpdatedVesselRows(
      {
        vesselLocation: makeLocation({
          AtDock: true,
          LeftDock: existingTrip.LeftDock,
          DepartingTerminalAbbrev: "MUK",
          DepartingTerminalName: "Mukilteo",
          ArrivingTerminalAbbrev: undefined,
          ScheduledDeparture: undefined,
          ScheduleKey: undefined,
          TimeStamp: ms("2026-03-13T12:00:00-07:00"),
        }),
        existingActiveTrip: existingTrip,
        events: continuingEvents({
          isCompletedTrip: true,
          didJustArriveAtDock: true,
          scheduleKeyChanged: true,
        }),
      },
      scheduleTables
    );
    const inferredTrip = inferredRows.activeVesselTrip;

    expect(inferredTrip?.ArrivingTerminalAbbrev).toBe("CLI");
    expect(inferredTrip?.ScheduledDeparture).toBe(nextSegment.DepartingTime);
    expect(inferredTrip?.ScheduleKey).toBe(nextSegment.Key);

    const authoritativeTrip = await buildActiveTrip({
      vesselLocation: makeLocation({
        AtDock: true,
        LeftDock: undefined,
        DepartingTerminalAbbrev: "MUK",
        DepartingTerminalName: "Mukilteo",
        ArrivingTerminalAbbrev: "CLI",
        ScheduledDeparture: nextSegment.DepartingTime,
        ScheduleKey: undefined,
        TimeStamp: ms("2026-03-13T12:01:00-07:00"),
      }),
      existingActiveTrip: inferredTrip,
      scheduleTables,
      events: continuingEvents({
        scheduleKeyChanged: true,
      }),
    });

    expect(authoritativeTrip?.ArrivingTerminalAbbrev).toBe("CLI");
    expect(authoritativeTrip?.ScheduledDeparture).toBe(
      nextSegment.DepartingTime
    );
    expect(authoritativeTrip?.ScheduleKey).toBe(nextSegment.Key);

    expect(authoritativeTrip).toBeDefined();
  });
});
