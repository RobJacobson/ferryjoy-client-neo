import { query } from "../../_generated/server";

/**
 * Get the latest 20 vessel pings from the database
 */
export const getLatest = query({
  args: {},
  handler: async (ctx) => {
    const latestPings = await ctx.db
      .query("vesselPings")
      .order("desc")
      .take(20);
    return latestPings;
  },
});
