import type { ConvexVesselLocation } from "../../../convex/functions/vesselLocation/schemas";
import { toDateOrUndefined } from "../utils";

export const toDomainVesselLocation = (location: ConvexVesselLocation) => ({
  ...location,
  LeftDock: toDateOrUndefined(location.LeftDock),
  Eta: toDateOrUndefined(location.Eta),
  ScheduledDeparture: toDateOrUndefined(location.ScheduledDeparture),
  TimeStamp: new Date(location.TimeStamp),
});

export type VesselLocation = ReturnType<typeof toDomainVesselLocation>;
