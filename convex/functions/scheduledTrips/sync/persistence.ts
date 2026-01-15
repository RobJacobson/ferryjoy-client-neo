import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledTrip } from "../schemas";

const logPrefix = "[SYNC TRIPS]";

/**
 * Result type for delete operations.
 */
export type DeleteResult = {
  deleted: number;
};

/**
 * Result type for insert operations.
 */
export type InsertResult = {
  inserted: number;
};

/**
 * Performs safe data replacement: deletes existing data, then inserts fresh data.
 * This ensures atomicity - either all data is replaced or none is.
 */
export const performSafeDataReplacement = async (
  ctx: ActionCtx,
  sailingDay: string,
  trips: ConvexScheduledTrip[]
): Promise<{
  deleted: number;
  inserted: number;
}> => {
  // Delete existing data first
  console.log(`${logPrefix} Deleting existing trips for ${sailingDay}`);
  const deleteResult = await deleteScheduledTripsForDate(ctx, sailingDay);
  console.log(
    `${logPrefix} Deleted ${deleteResult.deleted} existing trips for ${sailingDay}`
  );

  // Insert fresh data
  console.log(`${logPrefix} Inserting ${trips.length} fresh trips`);
  const insertResult = await insertScheduledTrips(ctx, trips);
  console.log(`${logPrefix} Inserted ${insertResult.inserted} fresh trips`);

  return {
    deleted: deleteResult.deleted,
    inserted: insertResult.inserted,
  };
};

/**
 * Deletes all scheduled trips for a specific sailing day.
 */
const deleteScheduledTripsForDate = async (
  ctx: ActionCtx,
  sailingDay: string
): Promise<DeleteResult> =>
  await ctx.runMutation(
    api.functions.scheduledTrips.mutations.deleteScheduledTripsForDate,
    { sailingDay }
  );

/**
 * Inserts multiple scheduled trips into the database.
 */
const insertScheduledTrips = async (
  ctx: ActionCtx,
  trips: ConvexScheduledTrip[]
): Promise<InsertResult> => {
  if (trips.length === 0) {
    return { inserted: 0 };
  }

  return await ctx.runMutation(
    api.functions.scheduledTrips.mutations.insertScheduledTrips,
    { trips }
  );
};

/**
 * Checks if schedule data already exists for a specific sailing day.
 */
export const hasDataForDay = async (
  ctx: ActionCtx,
  sailingDay: string
): Promise<boolean> => {
  const trips = await ctx.runQuery(
    api.functions.scheduledTrips.queries.getScheduledTripsForSailingDay,
    { sailingDay }
  );
  return trips.length > 0;
};
