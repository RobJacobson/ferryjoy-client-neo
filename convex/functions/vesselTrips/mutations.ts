import { mutation } from "_generated/server";
import { ConvexError } from "convex/values";
import {
  calculateInitialPredictions,
  type InitialPredictions,
} from "domain/ml";
import {
  type ConvexVesselTrip,
  vesselTripSchema,
} from "functions/vesselTrips/schemas";

/**
 * Upsert an active trip (update if exists, insert if not)
 * Only one active trip per vessel allowed
 */
export const upsertActiveTrip = mutation({
  args: { trip: vesselTripSchema },
  handler: async (ctx, args: { trip: ConvexVesselTrip }) => {
    try {
      const existing = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.trip.VesselAbbrev)
        )
        .first();

      if (existing) {
        // Update existing trip
        await ctx.db.replace(existing._id, args.trip);
        return existing._id;
      } else {
        // Insert new trip
        const id = await ctx.db.insert("activeVesselTrips", args.trip);
        return id;
      }
    } catch (error) {
      throw new ConvexError({
        message: `Failed to upsert active trip for vessel ${args.trip.VesselAbbrev}`,
        code: "UPSERT_ACTIVE_TRIP_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.trip.VesselAbbrev,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Complete an active trip and start a new one
 * Performs three atomic operations:
 * 1. Insert the completed trip into completedVesselTrips
 * 2. Calculate ML predictions for the new trip (LeftDockPred and EtaPred)
 * 3. Overwrite the active trip with new trip data (including predictions)
 */
export const completeAndStartNewTrip = mutation({
  args: {
    completedTrip: vesselTripSchema,
    newTrip: vesselTripSchema,
  },
  handler: async (
    ctx,
    args: { completedTrip: ConvexVesselTrip; newTrip: ConvexVesselTrip }
  ) => {
    try {
      // Verify completed trip has TripEnd set
      if (!args.completedTrip.TripEnd) {
        throw new ConvexError({
          message: "Completed trip must have TripEnd set",
          code: "INVALID_COMPLETED_TRIP",
          severity: "error",
        });
      }

      // Get the existing active trip to overwrite
      const existingActive = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.completedTrip.VesselAbbrev)
        )
        .first();

      if (!existingActive) {
        throw new ConvexError({
          message: `No active trip found for vessel ${args.completedTrip.VesselAbbrev}`,
          code: "ACTIVE_TRIP_NOT_FOUND",
          severity: "error",
          details: { vesselAbbrev: args.completedTrip.VesselAbbrev },
        });
      }

      // 1. Insert completed trip
      const completedId = await ctx.db.insert(
        "completedVesselTrips",
        args.completedTrip
      );

      // 2. Calculate initial predictions for the new trip
      let predictions: InitialPredictions;
      try {
        predictions = await calculateInitialPredictions(
          ctx,
          args.completedTrip,
          args.newTrip
        );

        // Log prediction results for observability
        if (predictions.LeftDockPred) {
          console.log(
            `[ML Prediction] LeftDockPred calculated for ${args.newTrip.VesselAbbrev}:`,
            {
              vessel: args.newTrip.VesselAbbrev,
              departingTerminal: args.newTrip.DepartingTerminalAbbrev,
              arrivingTerminal: args.newTrip.ArrivingTerminalAbbrev,
              scheduledDeparture: args.newTrip.ScheduledDeparture,
              predictedLeftDock: predictions.LeftDockPred,
              leftDockMae: predictions.LeftDockPredMae,
            }
          );
        } else {
          console.log(
            `[ML Prediction] LeftDockPred skipped for ${args.newTrip.VesselAbbrev}`,
            {
              vessel: args.newTrip.VesselAbbrev,
              reason: "Insufficient data or model not found",
            }
          );
        }

        if (predictions.EtaPred) {
          console.log(
            `[ML Prediction] EtaPred calculated for ${args.newTrip.VesselAbbrev}:`,
            {
              vessel: args.newTrip.VesselAbbrev,
              departingTerminal: args.newTrip.DepartingTerminalAbbrev,
              arrivingTerminal: args.newTrip.ArrivingTerminalAbbrev,
              tripStart: args.newTrip.TripStart,
              predictedEta: predictions.EtaPred,
              etaMae: predictions.EtaPredMae,
            }
          );
        } else {
          console.log(
            `[ML Prediction] EtaPred skipped for ${args.newTrip.VesselAbbrev}`,
            {
              vessel: args.newTrip.VesselAbbrev,
              reason: "Insufficient data or model not found",
            }
          );
        }
      } catch (error) {
        // Prediction failure should not prevent trip creation
        console.error(
          `[ML Prediction] Failed to calculate initial predictions for ${args.newTrip.VesselAbbrev}:`,
          error
        );
        predictions = {
          LeftDockPred: undefined,
          LeftDockPredMae: undefined,
          EtaPred: undefined,
          EtaPredMae: undefined,
        };
      }

      // 3. Merge predictions into new trip data
      const newTripWithPredictions: ConvexVesselTrip = {
        ...args.newTrip,
        LeftDockPred: predictions.LeftDockPred,
        LeftDockPredMae: predictions.LeftDockPredMae,
        EtaPred: predictions.EtaPred,
        EtaPredMae: predictions.EtaPredMae,
      };

      // 4. Overwrite the active trip with new trip data (including predictions)
      await ctx.db.replace(existingActive._id, newTripWithPredictions);

      return {
        completedId,
        activeTripId: existingActive._id,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError({
        message: `Failed to complete and start new trip for vessel ${args.completedTrip.VesselAbbrev}`,
        code: "COMPLETE_AND_START_TRIP_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.completedTrip.VesselAbbrev,
          error: String(error),
        },
      });
    }
  },
});
