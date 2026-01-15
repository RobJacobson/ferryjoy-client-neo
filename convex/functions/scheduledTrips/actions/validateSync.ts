import { api } from "_generated/api";
import { action } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { fetchRoutesByTripDate } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../schemas";
import {
  fetchRouteSchedule,
  flattenScheduleToTrips,
  retryOnce,
  tripsEqual,
} from "./shared";
import type { ScheduledTripDoc, VerificationResult } from "./types";

/**
 * Verifies data consistency between WSF API and Convex database for a specific route
 * Useful for debugging sync issues and ensuring data integrity
 * @param routeId - Route ID to verify
 * @param sailingDay - Sailing day in YYYY-MM-DD format to check
 * @returns Verification result with detailed comparison
 */
export const verifyScheduledTripsForRoute = action({
  args: {
    routeId: v.number(),
    sailingDay: v.string(),
  },
  handler: async (ctx, args): Promise<VerificationResult> => {
    const { routeId, sailingDay } = args;
    const issues: string[] = [];

    try {
      console.log(`Verifying route ${routeId} for sailing day ${sailingDay}`);

      // For a given sailing day, we need to check WSF data from that day AND the next day
      // because some trips from the next calendar day belong to this sailing day
      const calendarDays = [sailingDay];

      // Calculate the next calendar day
      const sailingDate = new Date(`${sailingDay}T00:00:00.000Z`);
      const nextDay = new Date(sailingDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayString = nextDay.toISOString().split("T")[0];
      calendarDays.push(nextDayString);

      // 1. Fetch WSF data for both relevant calendar days
      const allWsfTrips: ConvexScheduledTrip[] = [];
      for (const calendarDay of calendarDays) {
        try {
          const routes = await retryOnce(() =>
            fetchRoutesByTripDate({ params: { TripDate: calendarDay } })
          );
          const route = routes.find((r) => r.RouteID === routeId);

          if (route) {
            const wsfSchedule = await fetchRouteSchedule(routeId, calendarDay);
            const trips = flattenScheduleToTrips(
              wsfSchedule,
              route,
              calendarDay
            );
            allWsfTrips.push(...trips);
          }
        } catch (error) {
          // If a calendar day has no data, that's fine - continue with others
          console.log(
            `Error for route ${routeId} on ${calendarDay}: ${error}}. No WSF data for this day, continuing...`
          );
        }
      }

      // 2. Filter WSF trips to only those belonging to our target sailing day
      // Since we now set SailingDay directly from the WSF API TripDate, we can filter by it directly
      const wsfTrips = allWsfTrips.filter(
        (trip) => trip.SailingDay === sailingDay
      );

      // 3. Fetch data from Convex database (filter by route and sailing day)
      const convexTrips = await ctx.runQuery(
        api.functions.scheduledTrips.queries
          .getScheduledTripsForRouteAndSailingDay,
        {
          routeId,
          sailingDay,
        }
      );

      // 4. First check: Ensure exact count match
      if (wsfTrips.length !== convexTrips.length) {
        const countError = `CRITICAL: Count mismatch - WSF has ${wsfTrips.length} trips, Convex has ${convexTrips.length} trips for route ${routeId} on sailing day ${sailingDay}`;
        console.error(countError);
        issues.push(countError);
        // For count mismatches, we should fail immediately rather than continue
        // as this indicates a fundamental data integrity issue
      }

      // 5. Compare datasets
      const wsfByKey = new Map(wsfTrips.map((t) => [t.Key, t]));
      const convexByKey = new Map(convexTrips.map((t) => [t.Key, t]));

      // Check for trips in WSF but missing from Convex
      for (const [key, wsfTrip] of wsfByKey) {
        const convexTrip = convexByKey.get(key) as ScheduledTripDoc | undefined;
        if (!convexTrip) {
          issues.push(`Missing in Convex: ${key}`);
        } else if (!tripsEqual(convexTrip, wsfTrip)) {
          issues.push(`Mismatch: ${key}`);
        }
      }

      // Check for trips in Convex but not in WSF (shouldn't happen with proper sync)
      for (const [key] of convexByKey) {
        if (!wsfByKey.has(key)) {
          issues.push(`Extra in Convex: ${key}`);
        }
      }

      const result: VerificationResult = {
        isValid: issues.length === 0 && wsfTrips.length === convexTrips.length,
        issues,
        wsfTripCount: wsfTrips.length,
        convexTripCount: convexTrips.length,
        routeId,
      };

      console.log(
        `Verification complete for route ${routeId}: ` +
          `${result.isValid ? "PASS" : "FAIL"} - ` +
          `WSF: ${result.wsfTripCount}, Convex: ${result.convexTripCount}, Issues: ${issues.length}`
      );

      if (!result.isValid) {
        console.log("Issues:", result.issues);
      }

      return result;
    } catch (error) {
      console.error(`Verification failed for route ${routeId}:`, error);
      throw new ConvexError({
        message: `Failed to verify scheduled trips for route ${routeId}`,
        code: "VERIFICATION_FAILED",
        severity: "error",
        details: { routeId, sailingDay, error: String(error) },
      });
    }
  },
});
