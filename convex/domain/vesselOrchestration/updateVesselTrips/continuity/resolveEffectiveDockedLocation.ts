/**
 * Domain orchestration for effective docked location identity during vessel-trip writes.
 */

import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  applyEffectiveTripIdentityToLocation,
  type EffectiveTripIdentity,
  hasStableDockedTripIdentity,
  resolveEffectiveDockedTripIdentity,
} from "shared/effectiveTripIdentity";
import { resolveDockedScheduledSegment } from "./resolveDockedScheduledSegment";

export type ResolveEffectiveDockedLocationResult = {
  effectiveLocation: ConvexVesselLocation;
  stableDockedIdentity: boolean;
  scheduledResolution: ReturnType<typeof resolveDockedScheduledSegment>;
  effectiveIdentity: EffectiveTripIdentity;
};

/**
 * Resolve effective trip identity for a location that is already known to be
 * docked at terminal (`AtDock` and no `LeftDock`), using injected schedule lookups.
 *
 * Matches the legacy `resolveEffectiveLocation` path after its early return.
 *
 * @param lookup - Schedule segment lookups (snapshot-backed in production)
 * @param location - Latest vessel location (docked-at-terminal branch only)
 * @param existingTrip - Active persisted trip for this vessel, if any
 * @returns Effective location plus fields needed for observability
 */
export const resolveEffectiveDockedLocation = (
  lookup: ScheduledSegmentLookup,
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): ResolveEffectiveDockedLocationResult => {
  const stableDockedIdentity = hasStableDockedTripIdentity(
    location,
    existingTrip
  );
  const scheduledResolution = stableDockedIdentity
    ? null
    : resolveDockedScheduledSegment(lookup, {
        vesselAbbrev: location.VesselAbbrev,
        departingTerminalAbbrev: location.DepartingTerminalAbbrev,
        existingTrip,
      });

  const effectiveIdentity = resolveEffectiveDockedTripIdentity({
    location,
    activeTrip: existingTrip,
    scheduledSegment: scheduledResolution?.segment,
    scheduledSegmentSource: scheduledResolution?.source,
  });
  const effectiveLocation = applyEffectiveTripIdentityToLocation(
    location,
    effectiveIdentity
  );

  return {
    effectiveLocation,
    stableDockedIdentity,
    scheduledResolution,
    effectiveIdentity,
  };
};
