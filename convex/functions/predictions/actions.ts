// import { api, internal } from "....//api";
// import type { ActionCtx } from "....//server";
// import { action, internalAction } from "....//server";
// import { v } from "convex/values";

// import { unixTsToDate } from "@/shared/utils/unixTsToDate";

// import type { ConvexActiveVesselTrip } from "../activeVesselTrips/schemas";
// import { toConvexActiveVesselTrip } from "../activeVesselTrips/schemas";
// import type { ConvexCompletedVesselTrip } from "../completedVesselTrips/schemas";
// import { toConvexCompletedVesselTrip } from "../completedVesselTrips/schemas";
// import type { CurrentPredictionData } from "./schemas";

// /**
//  * Cleans Convex objects by removing internal fields (_id, _creationTime)
//  * This ensures compatibility with validation schemas
//  */
// const cleanConvexObject = <T>(obj: any): T => {
//   const { _id, _creationTime, ...cleanObj } = obj;
//   return cleanObj as T;
// };

// /**
//  * Public action for generating a single prediction
//  * Clients can call this directly to get departure/arrival predictions for a vessel
//  */
// export const predictVesselTimeAction = action({
//   args: {
//     vesselId: v.number(),
//     routeAbbrev: v.string(),
//     predictionType: v.union(v.literal("departure"), v.literal("arrival")),
//   },
//   handler: async (
//     ctx,
//     args
//   ): Promise<{
//     success: boolean;
//     prediction?: CurrentPredictionData & {
//       predictedTimeFormatted: string;
//       scheduledTimeFormatted: string;
//     };
//     error?: string;
//   }> => {
//     try {
//       log.info(
//         `Generating ${args.predictionType} prediction for vessel ${args.vesselId} on route ${args.routeAbbrev}`
//       );

//       // Get the current trip for this vessel
//       log.info(`Querying for active trips...`);
//       const activeTrips = await ctx.runQuery(
//         api.functions.activeVesselTrips.queries.getActiveTrips
//       );
//       log.info(`Found ${activeTrips.length} active trips total`);

//       const currentTrip = activeTrips.find(
//         (t) =>
//           t.VesselID === args.vesselId && t.OpRouteAbbrev === args.routeAbbrev
//       );
//       log.info(`Current trip found: ${!!currentTrip}`);

//       if (!currentTrip) {
//         return {
//           success: false,
//           error: `No active trip found for vessel ${args.vesselId} on route ${args.routeAbbrev}`,
//         };
//       }

//       // Get completed trips to find previous trip data
//       log.info(`Querying for completed trips...`);
//       const completedTrips = await ctx.runQuery(
//         api.functions.completedVesselTrips.queries.getCompletedTrips
//       );
//       log.info(`Found ${completedTrips.length} completed trips total`);

//       // Find the previous trip for this vessel on the same route
//       const prevTrip = findPreviousTrip(
//         toConvexActiveVesselTrip(currentTrip),
//         completedTrips.map(toConvexCompletedVesselTrip)
//       );

//       if (!prevTrip) {
//         return {
//           success: false,
//           error: `No previous trip found for vessel ${args.vesselId} on route ${args.routeAbbrev}`,
//         };
//       }

//       // Debug: Log the trip data being passed to ML module
//       log.info(`Current trip data:`, {
//         vesselId: currentTrip.VesselID,
//         route: currentTrip.OpRouteAbbrev,
//         scheduledDeparture: currentTrip.ScheduledDeparture,
//         hasArrivingTerminalAbbrev: !!currentTrip.ArrivingTerminalAbbrev,
//         hasDepartingTerminalAbbrev: !!currentTrip.DepartingTerminalAbbrev,
//       });

//       log.info(`Previous trip data:`, {
//         vesselId: prevTrip.VesselID,
//         route: prevTrip.OpRouteAbbrev,
//         hasArvDockActual: !!prevTrip.ArvDockActual,
//         hasScheduledDeparture: !!prevTrip.ScheduledDeparture,
//         hasLeftDockDelay: !!prevTrip.LeftDockDelay,
//         hasDepartingTerminalAbbrev: !!prevTrip.DepartingTerminalAbbrev,
//       });

//       // Generate prediction using ML module
//       const prediction = await ctx.runAction(
//         internal.ml.actions.predictTimeAction,
//         {
//           prevTrip,
//           currTrip: toConvexActiveVesselTrip(currentTrip),
//         }
//       );

//       // Transform ML output to database format
//       const scheduledTime = currentTrip.ScheduledDeparture?.getTime() || 0;
//       const predictedTime =
//         scheduledTime + prediction.predictedDelayMinutes * 60 * 1000; // Convert minutes to milliseconds

//       const predictionData: CurrentPredictionData = {
//         vesselId: currentTrip.VesselID,
//         predictionType: args.predictionType,
//         vesselName: currentTrip.VesselName,
//         opRouteAbrv: currentTrip.OpRouteAbbrev || "",
//         depTermAbrv: currentTrip.DepartingTerminalAbbrev,
//         arvTermAbrv: currentTrip.ArrivingTerminalAbbrev || "",
//         createdAt: Date.now(),
//         schedDep: scheduledTime,
//         predictedTime: predictedTime,
//         confidence: prediction.confidence || 0,
//         modelVersion: "v1.0", // Default model version
//       };

//       // Store prediction in database
//       await ctx.runMutation(
//         api.functions.predictions.mutations.updateCurrentPredictionMutation,
//         { prediction: predictionData }
//       );

//       log.info(
//         `Successfully generated and stored ${args.predictionType} prediction for vessel ${args.vesselId}`
//       );

//       // Format the timestamps for display
//       // Note: prediction.predictedTime is already denormalized from the ML model
//       const scheduledTimeDenormalized =
//         currentTrip.ScheduledDeparture?.getTime() || 0;

//       // Debug: Log the timestamp values
//       log.info(`Raw predicted time from ML: ${predictedTime}`);
//       log.info(`Raw scheduled time: ${scheduledTimeDenormalized}`);
//       log.info(`Predicted time as Date: ${new Date(predictedTime)}`);
//       log.info(
//         `Scheduled time as Date: ${new Date(scheduledTimeDenormalized)}`
//       );

//       return {
//         success: true,
//         prediction: {
//           ...predictionData,
//           predictedTimeFormatted: unixTsToDate(predictedTime),
//           scheduledTimeFormatted: unixTsToDate(scheduledTimeDenormalized),
//         },
//       };
//     } catch (error) {
//       log.error(
//         `Failed to generate ${args.predictionType} prediction for vessel ${args.vesselId}:`,
//         error
//       );
//       return {
//         success: false,
//         error: `Failed to generate prediction: ${error}`,
//       };
//     }
//   },
// });

// /**
//  * Updates predictions for all active vessels
//  * Generates both departure and arrival time predictions using trained ML models
//  */
// export const updatePredictions = internalAction({
//   args: {},
//   handler: async (
//     ctx: ActionCtx
//   ): Promise<{ success: boolean; message: string; count?: number }> => {
//     log.info("Starting prediction updates for active vessels");

//     try {
//       // Get active trips that need predictions
//       const activeTrips = await ctx.runQuery(
//         api.functions.activeVesselTrips.queries.getActiveTrips
//       );
//       log.info(`Found ${activeTrips.length} active trips to update`);

//       if (activeTrips.length === 0) {
//         return {
//           success: true,
//           message: "No active trips to update",
//           count: 0,
//         };
//       }

//       // Get completed trips to find previous trip data for each active trip
//       const completedTrips = await ctx.runQuery(
//         api.functions.completedVesselTrips.queries.getCompletedTrips
//       );

//       const results = await Promise.all(
//         activeTrips.map((trip) =>
//           updateVesselPredictions(
//             ctx,
//             toConvexActiveVesselTrip(trip),
//             completedTrips.map(toConvexCompletedVesselTrip)
//           )
//         )
//       );

//       const successfulUpdates = results.filter((r) => r.success).length;

//       log.info(
//         `Successfully updated predictions for ${successfulUpdates}/${activeTrips.length} vessels`
//       );

//       return {
//         success: true,
//         message: `Updated predictions for ${successfulUpdates} vessels`,
//         count: successfulUpdates,
//       };
//     } catch (error) {
//       log.error("Failed to update predictions:", error);
//       return {
//         success: false,
//         message: `Failed to update predictions: ${error}`,
//       };
//     }
//   },
// });

// /**
//  * Updates predictions for a single vessel
//  * Generates both departure and arrival predictions using the ML module
//  */
// const updateVesselPredictions = async (
//   ctx: ActionCtx,
//   trip: ConvexActiveVesselTrip,
//   completedTrips: ConvexCompletedVesselTrip[]
// ): Promise<{
//   success: boolean;
//   departureSuccess: boolean;
//   arrivalSuccess: boolean;
// }> => {
//   try {
//     // Find the previous trip for this vessel on the same route
//     const prevTrip = findPreviousTrip(trip, completedTrips);

//     if (!prevTrip) {
//       log.info(
//         `No previous trip found for vessel ${trip.VesselID} on route ${trip.OpRouteAbbrev}`
//       );
//       return { success: false, departureSuccess: false, arrivalSuccess: false };
//     }

//     const results = await Promise.all([
//       // Generate departure prediction
//       generateAndStorePrediction(ctx, trip, prevTrip, "departure"),
//       // Generate arrival prediction
//       generateAndStorePrediction(ctx, trip, prevTrip, "arrival"),
//     ]);

//     const departureSuccess = results[0];
//     const arrivalSuccess = results[1];

//     return {
//       success: departureSuccess || arrivalSuccess,
//       departureSuccess,
//       arrivalSuccess,
//     };
//   } catch (error) {
//     log.error(
//       `Failed to update predictions for vessel ${trip.VesselID}:`,
//       error
//     );
//     return { success: false, departureSuccess: false, arrivalSuccess: false };
//   }
// };

// /**
//  * Finds the previous trip for a given vessel on the same route
//  */
// const findPreviousTrip = (
//   currentTrip: ConvexActiveVesselTrip,
//   completedTrips: ConvexCompletedVesselTrip[]
// ): ConvexCompletedVesselTrip | null => {
//   log.info(
//     `Looking for previous trip for vessel ${currentTrip.VesselID} on route ${currentTrip.OpRouteAbbrev}`
//   );
//   log.info(`Total completed trips: ${completedTrips.length}`);

//   const candidates = completedTrips.filter(
//     (t) =>
//       t.VesselID === currentTrip.VesselID &&
//       t.OpRouteAbbrev === currentTrip.OpRouteAbbrev &&
//       t.LeftDockDelay && // Must have completed
//       t.LeftDockDelay < (currentTrip.TimeStamp || 0) // Must be before current trip
//   );

//   log.info(`Found ${candidates.length} candidate previous trips`);

//   if (candidates.length > 0) {
//     const bestMatch = candidates.sort(
//       (a, b) => (b.LeftDockDelay || 0) - (a.LeftDockDelay || 0)
//     )[0];
//     log.info(
//       `Best previous trip: vessel ${bestMatch.VesselID}, left dock at ${bestMatch.LeftDockDelay}`
//     );
//     return bestMatch;
//   }

//   log.info(`No previous trip found`);
//   return null;
// };

// /**
//  * Generates and stores a prediction for a specific trip and type
//  */
// const generateAndStorePrediction = async (
//   ctx: ActionCtx,
//   currentTrip: ConvexActiveVesselTrip,
//   prevTrip: ConvexCompletedVesselTrip,
//   predictionType: "departure" | "arrival"
// ): Promise<boolean> => {
//   try {
//     // Generate prediction using ML module
//     const prediction = await ctx.runAction(
//       internal.ml.actions.predictTimeAction,
//       {
//         prevTrip,
//         currTrip: currentTrip,
//       }
//     );

//     // Transform ML output to database format
//     const scheduledTime = currentTrip.ScheduledDeparture || 0;
//     const predictedTime =
//       scheduledTime + prediction.predictedDelayMinutes * 60 * 1000; // Convert minutes to milliseconds

//     const predictionData: CurrentPredictionData = {
//       vesselId: currentTrip.VesselID,
//       predictionType,
//       vesselName: currentTrip.VesselName,
//       opRouteAbrv: currentTrip.OpRouteAbbrev || "",
//       depTermAbrv: currentTrip.DepartingTerminalAbbrev,
//       arvTermAbrv: currentTrip.ArrivingTerminalAbbrev || "",
//       createdAt: Date.now(),
//       schedDep: scheduledTime,
//       predictedTime: predictedTime,
//       confidence: prediction.confidence || 0,
//       modelVersion: "v1.0", // Default model version
//     };

//     // Store prediction in database
//     await ctx.runMutation(
//       api.functions.predictions.mutations.updateCurrentPredictionMutation,
//       { prediction: predictionData }
//     );

//     log.info(
//       `Successfully stored ${predictionType} prediction for vessel ${currentTrip.VesselID}`
//     );
//     return true;
//   } catch (error) {
//     log.error(
//       `Failed to generate ${predictionType} prediction for vessel ${currentTrip.VesselID}:`,
//       error
//     );
//     return false;
//   }
// };
