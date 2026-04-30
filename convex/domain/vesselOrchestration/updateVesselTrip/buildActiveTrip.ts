/**
 * Active-trip row shaping for first-seen, replacement, and continuing updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveTripIdentity, type TripIdentity } from "shared/tripIdentity";
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
  switch (mode) {
    case "coldStart":
      return buildColdStartActiveTrip(context);
    case "newTrip":
      return buildNewActiveTrip(context);
    case "continuing":
      return buildContinuingActiveTrip(context);
  }
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
}): TripBuildMode =>
  isNewTrip ? "newTrip" : prev !== undefined ? "continuing" : "coldStart";

/**
 * Derives schedule-facing trip identity fields from the current ping.
 *
 * @param curr - Current vessel location ping
 * @param overrides - Optional identity overrides for continuing-trip resolution
 * @returns Derived trip identity including ScheduleKey and SailingDay
 */
const buildTripIdentityFromCurr = (
  curr: ConvexVesselLocation,
  overrides?: {
    arrivingTerminalAbbrev?: string | undefined;
    scheduledDepartureMs?: number | undefined;
  }
): TripIdentity =>
  deriveTripIdentity({
    vesselAbbrev: curr.VesselAbbrev,
    departingTerminalAbbrev: curr.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev:
      overrides?.arrivingTerminalAbbrev ?? curr.ArrivingTerminalAbbrev,
    scheduledDepartureMs:
      overrides?.scheduledDepartureMs ?? curr.ScheduledDeparture,
  });

/**
 * Maps feed-owned location fields onto an active trip row.
 *
 * @param curr - Current vessel location ping
 * @returns Feed-owned active-trip field slice
 */
const buildLiveLocationFields = (curr: ConvexVesselLocation) => ({
  VesselAbbrev: curr.VesselAbbrev,
  DepartingTerminalAbbrev: curr.DepartingTerminalAbbrev,
  ArrivingTerminalAbbrev: curr.ArrivingTerminalAbbrev,
  RouteAbbrev: curr.RouteAbbrev,
  AtDock: curr.AtDockObserved,
  InService: curr.InService,
  TimeStamp: curr.TimeStamp,
  Eta: curr.Eta,
});

/**
 * Builds schedule seed fields for creation paths.
 *
 * @param curr - Current vessel location ping
 * @param identity - Derived trip identity from current feed values
 * @returns Schedule key and sailing day fields for cold/new trip rows
 */
const buildCreationScheduleFields = (
  curr: ConvexVesselLocation,
  identity: TripIdentity
): Pick<ConvexVesselTrip, "ScheduleKey" | "SailingDay"> => ({
  ScheduleKey: curr.ScheduleKey ?? identity.ScheduleKey,
  SailingDay: identity.SailingDay,
});

/**
 * Builds prior-leg continuity fields carried into rollover rows.
 *
 * @param priorLeg - Completed leg when present, otherwise previous active trip
 * @returns Prior-leg fields used for historical continuity
 */
const buildPriorLegFields = (
  priorLeg: ConvexVesselTrip | undefined
): Pick<
  ConvexVesselTrip,
  "PrevTerminalAbbrev" | "PrevScheduledDeparture" | "PrevLeftDock"
> => ({
  PrevTerminalAbbrev: priorLeg?.DepartingTerminalAbbrev,
  PrevScheduledDeparture: priorLeg?.ScheduledDeparture,
  PrevLeftDock: priorLeg?.LeftDockActual ?? priorLeg?.LeftDock ?? undefined,
});

/**
 * Computes continuing-trip departure lifecycle and timing fields.
 *
 * @param input - Previous trip, current ping, and resolved scheduled departure
 * @returns Continuing-only departure-related field updates
 */
const buildContinuingDepartureFields = ({
  prev,
  curr,
  resolvedScheduledDeparture,
}: {
  prev: ConvexVesselTrip;
  curr: ConvexVesselLocation;
  resolvedScheduledDeparture: number | undefined;
}): Pick<
  ConvexVesselTrip,
  "AtDockDuration" | "LeftDock" | "LeftDockActual" | "TripDelay"
> => {
  const resolvedLeftDock = leftDockTimeForUpdate(prev, curr);
  const justLeftDock = didLeaveDock(prev, curr);

  return {
    AtDockDuration: calculateTimeDelta(
      prev.TripEnd ?? prev.TripStart,
      resolvedLeftDock
    ),
    LeftDock: resolvedLeftDock,
    LeftDockActual:
      prev.LeftDockActual ??
      (justLeftDock ? (curr.LeftDock ?? curr.TimeStamp) : undefined),
    TripDelay: calculateTimeDelta(resolvedScheduledDeparture, resolvedLeftDock),
  };
};

/**
 * Builds the first-seen active trip row when no previous active trip exists.
 *
 * @param context - Build mode and trip/location inputs
 * @returns Cold-start active trip row
 */
const buildColdStartActiveTrip = (
  context: BuildTripContext
): ConvexVesselTrip => {
  const { curr } = context;
  const identity = buildTripIdentityFromCurr(curr);

  return {
    ...buildLiveLocationFields(curr),
    TripKey: generateTripKey(curr.VesselAbbrev, curr.TimeStamp),
    ...buildCreationScheduleFields(curr, identity),
    PrevTerminalAbbrev: undefined,
    TripStart: undefined,
    TripEnd: undefined,
    AtDockDuration: undefined,
    ScheduledDeparture: curr.ScheduledDeparture,
    LeftDock: curr.LeftDock,
    LeftDockActual: curr.LeftDock,
    TripDelay: calculateTimeDelta(curr.ScheduledDeparture, curr.LeftDock),
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    PrevScheduledDeparture: undefined,
    PrevLeftDock: undefined,
  };
};

/**
 * Builds a replacement active trip row for a newly started leg.
 *
 * @param context - Build mode and trip/location inputs
 * @returns New-trip active row with prior-leg continuity and departure resets
 */
const buildNewActiveTrip = (context: BuildTripContext): ConvexVesselTrip => {
  const { completedTrip, prev, curr } = context;
  const priorLeg = completedTrip ?? prev;
  const identity = buildTripIdentityFromCurr(curr);

  return {
    ...buildLiveLocationFields(curr),
    TripKey: generateTripKey(curr.VesselAbbrev, curr.TimeStamp),
    ...buildCreationScheduleFields(curr, identity),
    ...buildPriorLegFields(priorLeg),
    TripStart: curr.TimeStamp,
    TripEnd: undefined,
    AtDockDuration: undefined,
    ScheduledDeparture: curr.ScheduledDeparture,
    LeftDock: undefined,
    LeftDockActual: undefined,
    TripDelay: undefined,
    NextScheduleKey: prev?.NextScheduleKey,
    NextScheduledDeparture: prev?.NextScheduledDeparture,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
  };
};

/**
 * Builds the updated active trip row for an in-progress leg.
 *
 * @param context - Build mode and trip/location inputs
 * @returns Continuing active trip row with updated feed-derived fields
 */
const buildContinuingActiveTrip = (
  context: BuildTripContext
): ConvexVesselTrip => {
  const { prev, curr } = context;
  if (prev === undefined) {
    throw new Error("buildContinuingActiveTrip requires prev");
  }

  const resolvedArrivingTerminal =
    curr.ArrivingTerminalAbbrev ?? prev.ArrivingTerminalAbbrev;
  const resolvedScheduledDeparture =
    curr.ScheduledDeparture ?? prev.ScheduledDeparture;
  const identity = buildTripIdentityFromCurr(curr, {
    arrivingTerminalAbbrev: resolvedArrivingTerminal,
    scheduledDepartureMs: resolvedScheduledDeparture,
  });
  const departureFields = buildContinuingDepartureFields({
    prev,
    curr,
    resolvedScheduledDeparture,
  });

  return {
    ...prev,
    ...buildLiveLocationFields(curr),
    ArrivingTerminalAbbrev: resolvedArrivingTerminal,
    ScheduleKey: curr.ScheduleKey ?? prev.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay ?? prev.SailingDay,
    ScheduledDeparture: resolvedScheduledDeparture,
    ...departureFields,
    Eta: curr.Eta ?? prev.Eta,
  };
};
