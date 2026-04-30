import type {
  ScheduledTrip,
  VesselLocation,
  VesselTripWithScheduledTrip,
} from "@/types";
import type { TimelineItem, TimelinePipelineInput } from "../../types";

/** Full ML-shaped prediction for test fixtures (domain may also use minimal joins). */
type TestTripPrediction = {
  PredTime: Date;
  MinTime: Date;
  MaxTime: Date;
  MAE: number;
  StdDev: number;
  Actual?: Date;
  DeltaTotal?: number;
  DeltaRange?: number;
};

type TripPrediction = NonNullable<
  VesselTripWithScheduledTrip["AtDockDepartCurr"]
>;

export const at = (hours: number, minutes: number) =>
  new Date(Date.UTC(2026, 2, 18, hours, minutes));

export const makePrediction = (
  overrides: Partial<TestTripPrediction> = {}
): TripPrediction => {
  const predTime = overrides.PredTime ?? at(8, 5);

  const full: TestTripPrediction = {
    PredTime: predTime,
    MinTime: overrides.MinTime ?? new Date(predTime.getTime() - 2 * 60_000),
    MaxTime: overrides.MaxTime ?? new Date(predTime.getTime() + 2 * 60_000),
    MAE: overrides.MAE ?? 3,
    StdDev: overrides.StdDev ?? 1,
    Actual: overrides.Actual,
    DeltaTotal: overrides.DeltaTotal,
    DeltaRange: overrides.DeltaRange,
  };
  return full as TripPrediction;
};

export const makeScheduledTrip = (
  overrides: Partial<ScheduledTrip> = {}
): ScheduledTrip => ({
  VesselAbbrev: "WEN",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalAbbrev: "BBI",
  DepartingTime: at(8, 0),
  ArrivingTime: at(8, 35),
  SailingNotes: "",
  Annotations: [],
  RouteID: 1,
  RouteAbbrev: "SEA-BBI",
  Key: "WEN--2026-03-18--08:00--P52-BBI",
  SailingDay: "2026-03-18",
  TripType: "direct",
  NextKey: "WEN--2026-03-18--09:00--BBI-P52",
  NextDepartingTime: at(9, 0),
  EstArriveNext: at(8, 35),
  EstArriveCurr: at(7, 40),
  SchedArriveNext: at(8, 35),
  SchedArriveCurr: at(7, 40),
  ...overrides,
});

export const makeTrip = (
  overrides: Partial<VesselTripWithScheduledTrip> = {}
): VesselTripWithScheduledTrip =>
  ({
    VesselAbbrev: "WEN",
    DepartingTerminalAbbrev: "P52",
    ArrivingTerminalAbbrev: "BBI",
    RouteAbbrev: "SEA-BBI",
    TripKey: "fixture-trip-key",
    ScheduleKey: "trip-1",
    SailingDay: "2026-03-18",
    PrevTerminalAbbrev: "BBI",
    TripEnd: undefined,
    TripStart: at(7, 42),
    AtDock: true,
    AtDockDuration: 8,
    ScheduledDeparture: at(8, 0),
    LeftDock: undefined,
    LeftDockActual: undefined,
    TripDelay: 5,
    Eta: undefined,
    InService: true,
    TimeStamp: at(7, 50),
    PrevScheduledDeparture: at(7, 0).getTime(),
    PrevLeftDock: at(7, 5).getTime(),
    NextScheduleKey: "WEN--2026-03-18--09:00--BBI-P52",
    NextScheduledDeparture: at(9, 0),
    AtDockDepartCurr: makePrediction({ PredTime: at(8, 5) }),
    AtDockArriveNext: makePrediction({ PredTime: at(8, 38) }),
    AtDockDepartNext: makePrediction({ PredTime: at(9, 5) }),
    AtSeaArriveNext: makePrediction({ PredTime: at(8, 35) }),
    AtSeaDepartNext: makePrediction({ PredTime: at(9, 10) }),
    ScheduledTrip: makeScheduledTrip(),
    ...overrides,
  }) as VesselTripWithScheduledTrip;

export const makeVesselLocation = (
  overrides: Partial<VesselLocation> = {}
): VesselLocation => ({
  VesselID: 1,
  VesselName: "Wenatchee",
  VesselAbbrev: "WEN",
  DepartingTerminalID: 1,
  DepartingTerminalName: "Seattle",
  DepartingTerminalAbbrev: "P52",
  ArrivingTerminalID: 2,
  ArrivingTerminalName: "Bainbridge Island",
  ArrivingTerminalAbbrev: "BBI",
  Latitude: 47.6026,
  Longitude: -122.3393,
  Speed: 0,
  Heading: 90,
  InService: true,
  AtDock: true,
  LeftDock: undefined,
  Eta: undefined,
  ScheduledDeparture: at(8, 0),
  RouteAbbrev: "SEA-BBI",
  VesselPositionNum: 1,
  TimeStamp: at(7, 50),
  ScheduleKey: "trip-1",
  ...overrides,
  AtDockObserved: overrides.AtDockObserved ?? true,
});

export const makeTimelineItem = ({
  trip,
  vesselLocation,
}: {
  trip?: Partial<VesselTripWithScheduledTrip>;
  vesselLocation?: Partial<VesselLocation>;
} = {}): TimelineItem => ({
  trip: makeTrip(trip),
  vesselLocation: makeVesselLocation(vesselLocation),
});

export const makeGetTerminalNameByAbbrev = (
  overrides: Record<string, string | null> = {}
) => {
  const terminalNames: Record<string, string | null> = {
    P52: "Seattle",
    BBI: "Bainbridge Island",
    VAI: "Vashon Island",
    FAU: "Fauntleroy",
    ...overrides,
  };

  return (terminalAbbrev: string) => terminalNames[terminalAbbrev] ?? null;
};

export const makePipelineInput = ({
  trip,
  vesselLocation,
  terminalNames,
  now = at(7, 50),
}: {
  trip?: Partial<VesselTripWithScheduledTrip>;
  vesselLocation?: Partial<VesselLocation>;
  terminalNames?: Record<string, string | null>;
  now?: Date;
} = {}): TimelinePipelineInput => ({
  item: makeTimelineItem({ trip, vesselLocation }),
  getTerminalNameByAbbrev: makeGetTerminalNameByAbbrev(terminalNames),
  now,
});
