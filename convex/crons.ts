import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "update vessel locations",
  { seconds: 5 }, // every fifteen seconds
  internal.functions.vesselLocation.actions.updateVesselLocations
);

crons.interval(
  "update vessel trips",
  { seconds: 15 }, // every fifteen seconds
  internal.functions.vesselTrips.actions.updateVesselTrips
);

crons.interval(
  "fetch vessel pings",
  { seconds: 30 }, // every fifteen seconds
  internal.functions.vesselPings.actions.fetchAndStoreVesselPings
);

crons.interval(
  "fetch vessel ping",
  { minutes: 1 }, // every minute
  internal.functions.vesselPing.actions.fetchAndStoreVesselPing
);

export default crons;
