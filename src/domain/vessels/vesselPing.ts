import type { ConvexVesselPing } from "../../../convex/functions/vesselPings/schemas";

export const toDomainVesselPing = (ping: ConvexVesselPing) => ({
  ...ping,
  TimeStamp: new Date(ping.TimeStamp),
});

export type VesselPing = ReturnType<typeof toDomainVesselPing>;
