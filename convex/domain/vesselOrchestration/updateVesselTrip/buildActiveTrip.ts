/**
 * Active-trip row shaping for first-seen, replacement, and continuing updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveTripIdentity } from "shared/tripIdentity";
import { didLeaveDock, leftDockTimeForUpdate } from "./lifecycleSignals";

type BuildActiveTripInput = {
  prev: ConvexVesselTrip | undefined;
  completedTrip: ConvexVesselTrip | undefined;
  curr: ConvexVesselLocation;
  isNewTrip: boolean;
};

type TripBuildMode = "coldStart" | "newTrip" | "continuing";

type BuildTripContext = {
  mode: TripBuildMode;
  prev: ConvexVesselTrip | undefined;
  completedTrip: ConvexVesselTrip | undefined;
  curr: ConvexVesselLocation;
};

/**
 * Builds the next active trip row for one vessel ping.
 *
 * @param input - Prior trip context, current location, and lifecycle transition
 * @returns Active trip row to persist
 */
export const buildActiveTrip = ({
  prev,
  completedTrip,
  curr,
  isNewTrip,
}: BuildActiveTripInput): ConvexVesselTrip => {
  const mode = resolveTripBuildMode({ prev, isNewTrip });
  const context: BuildTripContext = {
    mode,
    prev,
    completedTrip,
    curr,
  };
  const baseTrip = buildBaseActiveTrip(context);

  if (mode === "continuing") {
    return continuingTripPatch(context);
  }

  if (mode === "newTrip") {
    return {
      ...baseTrip,
      ...newTripPatch(context),
    };
  }

  return baseTrip;
};

/**
 * Resolves which active-trip build mode to apply.
 *
 * @param input - Existing-trip context and lifecycle signal
 * @returns Build mode for cold-start, rollover, or continuing updates
 */
const resolveTripBuildMode = ({
  prev,
  isNewTrip,
}: {
  prev: ConvexVesselTrip | undefined;
  isNewTrip: boolean;
}): TripBuildMode => {
  if (isNewTrip) {
    return "newTrip";
  }

  if (prev !== undefined) {
    return "continuing";
  }

  return "coldStart";
};

/**
 * Builds shared active-trip fields across all build modes.
 *
 * @param context - Build mode and trip/location inputs
 * @returns Base active-trip row before mode-specific patches
 */
const buildBaseActiveTrip = (context: BuildTripContext): ConvexVesselTrip => {
  const { curr } = context;
  const identity = deriveTripIdentity({
    vesselAbbrev: curr.VesselAbbrev,
    departingTerminalAbbrev: curr.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: curr.ArrivingTerminalAbbrev,
    scheduledDepartureMs: curr.ScheduledDeparture,
  });

  return {
    VesselAbbrev: curr.VesselAbbrev,
    DepartingTerminalAbbrev: curr.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: curr.ArrivingTerminalAbbrev,
    RouteAbbrev: curr.RouteAbbrev,
    TripKey: context.prev?.TripKey ?? baseTripKey(context),
    ScheduleKey: curr.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay,
    PrevTerminalAbbrev: undefined,
    TripStart: context.mode === "coldStart" ? undefined : curr.TimeStamp,
    TripEnd: undefined,
    AtDock: curr.AtDockObserved,
    AtDockDuration: undefined,
    ScheduledDeparture: curr.ScheduledDeparture,
    LeftDock: curr.LeftDock,
    LeftDockActual:
      context.mode === "coldStart" ? curr.LeftDock : undefined,
    TripDelay: calculateTimeDelta(
      curr.ScheduledDeparture,
      curr.LeftDock
    ),
    Eta: curr.Eta,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    InService: curr.InService,
    TimeStamp: curr.TimeStamp,
    PrevScheduledDeparture: undefined,
    PrevLeftDock: undefined,
  };
};

/**
 * Builds rollover-only field updates for a replacement/new trip.
 *
 * @param context - Build mode and trip/location inputs
 * @returns Sparse patch for new-trip-specific continuity and resets
 */
const newTripPatch = (context: BuildTripContext): Partial<ConvexVesselTrip> => {
  const { completedTrip, prev, curr } = context;
  const priorLeg = completedTrip ?? prev;
  const priorLegDeparture =
    priorLeg?.LeftDockActual ?? priorLeg?.LeftDock ?? undefined;

  return {
    PrevTerminalAbbrev: priorLeg?.DepartingTerminalAbbrev,
    TripStart: curr.TimeStamp,
    LeftDock: undefined,
    LeftDockActual: undefined,
    TripDelay: undefined,
    NextScheduleKey: prev?.NextScheduleKey,
    NextScheduledDeparture: prev?.NextScheduledDeparture,
    PrevScheduledDeparture: priorLeg?.ScheduledDeparture,
    PrevLeftDock: priorLegDeparture,
  };
};

/**
 * Builds continuing-only field updates for an in-progress trip.
 *
 * @param context - Build mode and trip/location inputs
 * @returns Continuing active trip row with updated feed-derived fields
 */
const continuingTripPatch = (context: BuildTripContext): ConvexVesselTrip => {
  const { prev, curr } = context;
  if (prev === undefined) {
    throw new Error("continuingTripPatch requires prev");
  }

  const resolvedArrivingTerminal =
    curr.ArrivingTerminalAbbrev ?? prev.ArrivingTerminalAbbrev;
  const resolvedScheduledDeparture =
    curr.ScheduledDeparture ?? prev.ScheduledDeparture;
  const identity = deriveTripIdentity({
    vesselAbbrev: curr.VesselAbbrev,
    departingTerminalAbbrev: curr.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: resolvedArrivingTerminal,
    scheduledDepartureMs: resolvedScheduledDeparture,
  });
  const resolvedLeftDock = leftDockTimeForUpdate(prev, curr);
  const justLeftDock = didLeaveDock(prev, curr);

  return {
    ...prev,
    VesselAbbrev: curr.VesselAbbrev,
    DepartingTerminalAbbrev: curr.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: resolvedArrivingTerminal,
    RouteAbbrev: curr.RouteAbbrev,
    ScheduleKey:
      curr.ScheduleKey ?? prev.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay ?? prev.SailingDay,
    AtDock: curr.AtDockObserved,
    AtDockDuration: calculateTimeDelta(
      prev.TripEnd ?? prev.TripStart,
      resolvedLeftDock
    ),
    ScheduledDeparture: resolvedScheduledDeparture,
    LeftDock: resolvedLeftDock,
    LeftDockActual:
      prev.LeftDockActual ??
      (justLeftDock ? (curr.LeftDock ?? curr.TimeStamp) : undefined),
    TripDelay: calculateTimeDelta(resolvedScheduledDeparture, resolvedLeftDock),
    Eta: curr.Eta ?? prev.Eta,
    InService: curr.InService,
    TimeStamp: curr.TimeStamp,
  };
};

/**
 * Generates a new trip key when no active trip exists.
 *
 * @param context - Build mode and trip/location inputs
 * @returns Generated trip key for non-continuing paths
 */
const baseTripKey = (context: BuildTripContext): string =>
  generateTripKey(context.curr.VesselAbbrev, context.curr.TimeStamp);
