import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "update vessel trips",
  { seconds: 15 }, // every fifteen seconds
  internal.functions.vesselData.actions.updateVesselData
);

// crons.cron(
//   "update vessel trips",
//   "* * * * *", // every minute
//   internal.functions.vesselData.actions.updateVesselData
// );

crons.cron(
  "fetch vessel pings",
  "* * * * *", // every minute
  internal.functions.vesselPings.actions.fetchAndStoreVesselPings
);

// Register a cron job to cleanup old vessel pings every hour
crons.cron(
  "cleanup old vessel pings",
  "0 * * * *", // Every hour
  internal.functions.vesselPings.actions.cleanupOldPings
);

export default crons;
