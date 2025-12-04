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

// Register a cron job to cleanup old vessel pings every hour
crons.cron(
  "cleanup old vessel pings",
  "0 * * * *", // Every hour
  internal.functions.vesselPings.actions.cleanupOldPings
);

export default crons;
