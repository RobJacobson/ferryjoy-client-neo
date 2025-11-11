import type { ConvexCompletedVesselTrip } from "../../../convex/functions/completedVesselTrips/schemas";
import { toDateOrUndefined } from "../utils";

export const toDomainCompletedVesselTrip = (
  trip: ConvexCompletedVesselTrip
) => ({
  ...trip,
  ScheduledDeparture: toDateOrUndefined(trip.ScheduledDeparture),
  LeftDock: toDateOrUndefined(trip.LeftDock),
  LeftDockActual: new Date(trip.LeftDockActual),
  Eta: toDateOrUndefined(trip.Eta),
  TimeStamp: new Date(trip.TimeStamp),
  TripStart: new Date(trip.TripStart),
  TripEnd: new Date(trip.TripEnd),
});

export type CompletedVesselTrip = ReturnType<
  typeof toDomainCompletedVesselTrip
>;
