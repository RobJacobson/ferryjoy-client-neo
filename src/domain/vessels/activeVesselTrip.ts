import type { ConvexActiveVesselTrip } from "../../../convex/functions/activeVesselTrips/schemas";
import { toDateOrUndefined } from "../utils";

export const toDomainActiveVesselTrip = (trip: ConvexActiveVesselTrip) => ({
  ...trip,
  ScheduledDeparture: toDateOrUndefined(trip.ScheduledDeparture),
  LeftDock: toDateOrUndefined(trip.LeftDock),
  LeftDockActual: toDateOrUndefined(trip.LeftDockActual),
  Eta: toDateOrUndefined(trip.Eta),
  TimeStamp: new Date(trip.TimeStamp),
  TripStart: new Date(trip.TripStart),
});

export type ActiveVesselTrip = ReturnType<typeof toDomainActiveVesselTrip>;
